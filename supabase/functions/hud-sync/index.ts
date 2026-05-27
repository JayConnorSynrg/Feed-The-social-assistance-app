import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import {
  createSyncHandler,
  type SourceConfig,
  type ResourceRow,
  type SyncParams,
} from '../_shared/resource-pipeline.ts'

interface HUDCounselor {
  agcid: string
  nme: string
  adr1: string
  adr2: string | null
  city: string
  statecd: string
  zipcd: string
  phone1: string
  phone2: string | null
  email: string | null
  weburl: string | null
  agc_ADDR_LATITUDE: string
  agc_ADDR_LONGITUDE: string
  services: string | null
  languages: string | null
  faithbased: string | null
  counslg_METHOD: string | null
}

const HUD_API_BASE = 'https://data.hud.gov/Housing_Counselor/searchByLocation'

const hudConfig: SourceConfig = {
  source: 'hud',
  defaultCategory: 'housing',
  batchSize: 500,
  rateDelayMs: 500,

  async fetchRecords(_params: SyncParams): Promise<HUDCounselor[]> {
    // Query from US geographic center with max radius to get all agencies
    const url = `${HUD_API_BASE}?Lat=39.8283&Long=-98.5795&Distance=99999`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HUD API returned ${response.status}: ${await response.text()}`)
    }
    const data = await response.json()
    if (!Array.isArray(data)) {
      throw new Error('HUD API did not return an array')
    }
    return data as HUDCounselor[]
  },

  transformRecord(raw: unknown): (ResourceRow & { _lat?: number; _lng?: number }) | null {
    const r = raw as HUDCounselor
    if (!r.nme?.trim() || !r.agcid) return null

    const lat = parseFloat(r.agc_ADDR_LATITUDE)
    const lng = parseFloat(r.agc_ADDR_LONGITUDE)

    const services = r.services?.split(',').map(s => s.trim()).filter(Boolean) ?? null
    const methods = r.counslg_METHOD?.split(',').map(m => m.trim()).filter(Boolean) ?? []

    return {
      external_id: `hud_${r.agcid}`,
      source: 'hud',
      name: r.nme.trim(),
      category: 'housing',
      description: methods.length > 0
        ? `Housing counseling: ${methods.join(', ')}`
        : 'HUD-approved housing counseling agency',
      address_line1: r.adr1?.trim() || null,
      city: r.city?.trim() || null,
      state: r.statecd?.trim() || null,
      zip_code: r.zipcd?.trim() || null,
      phone: r.phone1?.trim() || null,
      email: r.email?.trim() || null,
      website: r.weburl?.trim() || null,
      hours_of_operation: null,
      eligibility_requirements: null,
      services_offered: services,
      status: 'approved',
      is_verified: true,
      last_verified_at: new Date().toISOString(),
      _lat: isNaN(lat) ? undefined : lat,
      _lng: isNaN(lng) ? undefined : lng,
    } as any
  },
}

serve(createSyncHandler(hudConfig))
