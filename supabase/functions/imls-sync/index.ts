import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import {
  initSupabase,
  getCorsHeaders,
  authorizeRequest,
  createSyncLogger,
  type ResourceRow,
} from '../_shared/resource-pipeline.ts'

const IMLS_CSV_URL = 'https://www.imls.gov/sites/default/files/2025-08/pls_fy2023_csv.zip'

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!authorizeRequest(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Accept optional state filter from request body
  let stateFilter: string | null = null
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      if (body?.state && typeof body.state === 'string') {
        stateFilter = body.state.toUpperCase().trim()
      }
    } catch {
      // No body or invalid JSON — proceed without filter
    }
  }

  const logger = createSyncLogger('imls')

  try {
    const supabase = initSupabase()

    // Phase 1: Fetch CSV zip
    logger.log('fetch', { records_fetched: 0 })
    const zipResponse = await fetch(IMLS_CSV_URL)
    if (!zipResponse.ok) {
      throw new Error(`IMLS CSV download failed: ${zipResponse.status}`)
    }

    // Deno can handle zip via the Streams API + a lightweight CSV parser
    // For simplicity, we fetch the zip, extract the outlet CSV, and parse it
    const zipBuffer = await zipResponse.arrayBuffer()

    // Use Deno's built-in zip handling via the std library
    // The outlet file is: pls_fy23_outlet_pud23i.csv
    const { ZipReader, BlobReader, TextWriter } = await import('https://deno.land/x/zipjs@v2.7.34/index.js')
    const reader = new ZipReader(new BlobReader(new Blob([zipBuffer])))
    const entries = await reader.getEntries()

    const outletEntry = entries.find((e: any) => e.filename.toLowerCase().includes('outlet'))
    if (!outletEntry) {
      throw new Error('Outlet CSV not found in IMLS zip')
    }

    const csvText = await outletEntry.getData(new TextWriter())
    await reader.close()

    // Phase 2: Parse CSV
    const lines = csvText.split('\n')
    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine)

    const colIdx = {
      LIBNAME: headers.indexOf('LIBNAME'),
      ADDRESS: headers.indexOf('ADDRESS'),
      CITY: headers.indexOf('CITY'),
      STABR: headers.indexOf('STABR'),
      ZIP: headers.indexOf('ZIP'),
      PHONE: headers.indexOf('PHONE'),
      LATITUDE: headers.indexOf('LATITUDE'),
      LONGITUD: headers.indexOf('LONGITUD'),
      FSCSKEY: headers.indexOf('FSCSKEY'),
      FSCS_SEQ: headers.indexOf('FSCS_SEQ'),
      HOURS: headers.indexOf('HOURS'),
      C_OUT_TY: headers.indexOf('C_OUT_TY'),
    }

    const rows: ResourceRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const cols = parseCSVLine(line)
      const name = cols[colIdx.LIBNAME]?.trim()
      if (!name) continue

      const stateAbbr = cols[colIdx.STABR]?.trim() || null

      // Apply state filter if provided
      if (stateFilter && stateAbbr !== stateFilter) continue

      const lat = parseFloat(cols[colIdx.LATITUDE] ?? '')
      const lng = parseFloat(cols[colIdx.LONGITUD] ?? '')
      const fscsKey = cols[colIdx.FSCSKEY]?.trim() ?? ''
      const fscsSeq = cols[colIdx.FSCS_SEQ]?.trim() ?? '0'

      const hasCoords = !isNaN(lat) && lat !== 0 && !isNaN(lng) && lng !== 0
      const location = hasCoords ? `SRID=4326;POINT(${lng} ${lat})` : null

      rows.push({
        external_id: `imls_${fscsKey}_${fscsSeq}`,
        source: 'imls' as any,
        name,
        category: 'other',
        description: 'Public library — job search, computer access, community programs',
        address_line1: cols[colIdx.ADDRESS]?.trim() || null,
        city: cols[colIdx.CITY]?.trim() || null,
        state: stateAbbr,
        zip_code: cols[colIdx.ZIP]?.trim() || null,
        phone: cols[colIdx.PHONE]?.trim() || null,
        email: null,
        website: null,
        hours_of_operation: cols[colIdx.HOURS] ? { weekly_hours: cols[colIdx.HOURS].trim() } : null,
        eligibility_requirements: null,
        services_offered: ['computer_access', 'job_search', 'community_programs'],
        status: 'approved',
        is_verified: true,
        last_verified_at: new Date().toISOString(),
        location,
      } as any)
    }

    const filterLabel = stateFilter ? `state ${stateFilter}` : 'all states'
    logger.log('transform', {
      records_transformed: rows.length,
      records_skipped: lines.length - 1 - rows.length,
      filter: filterLabel,
    })
    console.log(`Processing ${rows.length} rows for ${filterLabel}`)

    // Phase 3: Chunk upsert
    const batchSize = 500
    let upserted = 0, errored = 0

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize)

      const { error } = await supabase
        .from('resources')
        .upsert(chunk, { onConflict: 'external_id,source', ignoreDuplicates: false })

      if (error) {
        errored += chunk.length
        logger.log('error', { error: error.message, records_errored: chunk.length })
      } else {
        upserted += chunk.length
      }

      // Rate limit between batches
      if (i + batchSize < rows.length) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    logger.log('complete', {
      records_fetched: lines.length - 1,
      records_transformed: rows.length,
      records_upserted: upserted,
      records_errored: errored,
    })

    return new Response(JSON.stringify({
      success: errored === 0,
      source: 'imls',
      state_filter: stateFilter ?? 'all',
      fetched: lines.length - 1,
      transformed: rows.length,
      upserted,
      errored,
      duration_ms: logger.elapsed(),
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.log('error', { error: message })
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// Simple CSV line parser handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
