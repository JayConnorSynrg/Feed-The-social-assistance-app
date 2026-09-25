// withdraw-result.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Pure interpretation of the PostgREST result of a volunteer-listing withdraw
// (an UPDATE ... status='archived' ... .select('id')). Extracted so the hook and
// its unit test exercise the SAME logic — in particular the zero-affected-rows
// path, which must surface as an error instead of a silent success.

export interface SupabaseWriteResult<T> {
  data: T[] | null
  error: { message: string } | null
}

export interface WithdrawOutcome {
  ok: boolean
  error: string | null
}

export const WITHDRAW_ZERO_ROW_MESSAGE =
  'Could not withdraw this listing — it may already be withdrawn, or you are not its owner.'

/**
 * Interpret the result of the withdraw UPDATE.
 * - A PostgREST error surfaces verbatim.
 * - Zero affected rows (data null or empty) is a FAILURE, not a silent success:
 *   before P3.0 the update policy matched only pending rows, so archiving an
 *   approved listing matched nothing and reported success while doing nothing.
 * - One or more affected rows is success.
 */
export function interpretWithdrawResult(
  result: SupabaseWriteResult<{ id: string }>
): WithdrawOutcome {
  if (result.error) {
    return { ok: false, error: result.error.message }
  }
  if (!result.data || result.data.length === 0) {
    return { ok: false, error: WITHDRAW_ZERO_ROW_MESSAGE }
  }
  return { ok: true, error: null }
}
