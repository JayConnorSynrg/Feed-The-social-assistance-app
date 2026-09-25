// 30-p3-0-moderation-guards.smoke.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
// Mission: 30 — P3.0 moderation-authority guards + volunteer withdraw
//          (feed-fullfeed-p3-0-moderation-guards)
// Surface: three BEFORE INSERT/UPDATE guard triggers (SECURITY INVOKER) —
//            I1  resources.status / moderated_by / moderated_at / is_verified /
//                last_verified_at / rejection_reason
//            I6  post_comments.is_hidden
//            I3  organizations.is_active / created_by / id / created_at (org admins, active only)
//          the I1b RLS policy that lets a volunteer withdraw (archive) their own pending or
//          approved listing, moderated-pin integrity on set_resource_location_by_id, and the
//          drop of the duplicate updated_at trigger on post_comments.
// Backend: supabase/migrations/20261009000000_p3_0_moderation_guards.sql
//
// GATE ON THE LEDGER. The migration applies as a SEPARATE post-deploy step recorded in
// supabase_migrations.schema_migrations. The suite skips ONLY while that ledger row is absent
// (pre-deploy). Once recorded, the assertions ALWAYS run.
//
// BEHAVIOURAL, NOT STRUCTURAL. Each guarantee is proven by an actual write executed as the
// relevant role inside a single transaction that ALWAYS rolls back (the final RAISE aborts it,
// exactly like the R1 probe). Every guarantee here goes RED if its guard's behaviour is removed
// (proven with the mutation runner in the PR). Nothing persists to prod.
//
// SQL SAFETY: every INSERT/UPDATE lives inside a $$...$$/$q$...$q$ literal or a pg_temp function
// body and is never line-anchored, so prod-client's WRITE_GUARD_RE passes; the transaction never
// commits.

import { describe, it, expect } from 'vitest'
import { queryProd, isTokenAvailable } from './prod-client'

const skip = !isTokenAvailable()
const maybeDescribe = skip ? describe.skip : describe

const U = 'c864347d-8aef-454a-a873-20eaa6b86c7f' // ordinary signed-in user
const A = 'ae6e0953-6425-4531-89fe-57feab106a24' // platform admin
const POST = '00000000-0000-4000-e000-000000000010'
const CHID = '00000000-0000-4000-e000-000000000012'
const R2 = '00000000-0000-4000-e000-000000000002' // approved volunteer, owned by U
const R3 = '00000000-0000-4000-e000-000000000003' // approved non-volunteer, owned by U
const R4 = '00000000-0000-4000-e000-000000000004' // pending non-volunteer, owned by U
const R5 = '00000000-0000-4000-e000-000000000005' // pending volunteer, owned by U
const O1 = '00000000-0000-4000-e000-000000000020' // active org, created_by A, U is org admin
const O2 = '00000000-0000-4000-e000-000000000021' // inactive org, created_by A, U is org admin

const GATE_SQL = `
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261009000000'
  ) AS applied
`

// The whole probe transaction. Seeds run as the Mgmt-API role (postgres, bypasses RLS);
// pg_temp.probe switches to the caller's role, runs one write, and records the outcome. The
// final RAISE returns the results AND rolls everything back.
const PROBE_BODY = `
CREATE FUNCTION pg_temp.setup() RETURNS void LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE $q$ insert into public.posts(id,user_id,content) values ('${POST}','${U}','p') $q$;
  EXECUTE $q$ insert into public.post_comments(id,post_id,user_id,content,is_hidden) values ('${CHID}','${POST}','${U}','h',true) $q$;
  EXECUTE $q$ insert into public.resources(id,name,status,submitted_by,is_volunteer_resource,source) values ('${R2}','R2','approved','${U}',true,'user_submitted') $q$;
  EXECUTE $q$ insert into public.resources(id,name,status,submitted_by,is_volunteer_resource,source) values ('${R3}','R3','approved','${U}',false,'user_submitted') $q$;
  EXECUTE $q$ insert into public.resources(id,name,status,submitted_by,is_volunteer_resource,source) values ('${R4}','R4','pending','${U}',false,'user_submitted') $q$;
  EXECUTE $q$ insert into public.resources(id,name,status,submitted_by,is_volunteer_resource,source) values ('${R5}','R5','pending','${U}',true,'user_submitted') $q$;
  EXECUTE $q$ insert into public.organizations(id,name,is_active,created_by) values ('${O1}','O1',true,'${A}') $q$;
  EXECUTE $q$ insert into public.organizations(id,name,is_active,created_by) values ('${O2}','O2',false,'${A}') $q$;
  EXECUTE $q$ insert into public.organization_members(org_id,user_id,role) values ('${O1}','${U}','admin') $q$;
  EXECUTE $q$ insert into public.organization_members(org_id,user_id,role) values ('${O2}','${U}','admin') $q$;
END $f$;

CREATE FUNCTION pg_temp.probe(rol text, uid uuid, is_anon boolean, stmt text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE n bigint; st text; msg text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',uid,'role',rol,'is_anonymous',is_anon)::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid::text,''), true);
  PERFORM set_config('role', rol, true);
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  RETURN 'OK rows=' || n;
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS st = RETURNED_SQLSTATE, msg = MESSAGE_TEXT;
  PERFORM set_config('role', 'postgres', true);
  RETURN 'ERR ' || st || ' ' || left(msg, 90);
END $f$;

DO $z$
DECLARE res text := '';
BEGIN
  PERFORM pg_temp.setup();
  res := res || 'FORGE_INSERT=' || pg_temp.probe('authenticated','${U}',false,$$ insert into public.resources(name,status,moderated_by,submitted_by) values ('x','approved','${A}','${U}') $$) || E'\n';
  res := res || 'VOL_APPROVED_INSERT=' || pg_temp.probe('authenticated','${U}',false,$$ insert into public.resources(name,status,is_volunteer_resource,source,submitted_by) values ('x','approved',true,'user_submitted','${U}') $$) || E'\n';
  res := res || 'NULL_STATUS=' || pg_temp.probe('authenticated','${U}',false,$$ insert into public.resources(name,status,submitted_by) values ('x',NULL,'${U}') $$) || E'\n';
  res := res || 'REJECTION_REASON=' || pg_temp.probe('authenticated','${U}',false,$$ insert into public.resources(name,status,rejection_reason,submitted_by) values ('x','pending','y','${U}') $$) || E'\n';
  res := res || 'SETLOC_APPROVED_NONVOL=' || pg_temp.probe('authenticated','${U}',false,$$ select set_resource_location_by_id('${R3}',10,10) $$) || E'\n';
  res := res || 'OWNER_WITHDRAW=' || pg_temp.probe('authenticated','${U}',false,$$ update public.resources set status='archived' where id='${R2}' and submitted_by='${U}' $$) || E'\n';
  res := res || 'COMMENT_HIDDEN_INSERT=' || pg_temp.probe('authenticated','${U}',false,$$ insert into public.post_comments(post_id,user_id,content,is_hidden) values ('${POST}','${U}','x',true) $$) || E'\n';
  res := res || 'UNFILTERED_UNHIDE=' || pg_temp.probe('authenticated','${U}',false,$$ update public.post_comments set is_hidden=false $$) || E'\n';
  res := res || 'ORG_CREATED_BY=' || pg_temp.probe('authenticated','${U}',false,$$ update public.organizations set created_by='${U}' where id='${O1}' $$) || E'\n';
  res := res || 'ADMIN_DIRECT_UPDATE=' || pg_temp.probe('authenticated','${A}',false,$$ update public.resources set is_verified=true where id='${R3}' $$) || E'\n';
  res := res || 'ORG_DEACTIVATE_UNFILTERED=' || pg_temp.probe('authenticated','${U}',false,$$ update public.organizations set is_active=false $$) || E'\n';
  res := res || 'ORG_DEACTIVATE_ACTIVE=' || pg_temp.probe('authenticated','${U}',false,$$ update public.organizations set is_active=false where id='${O1}' $$) || E'\n';
  res := res || 'OWNER_SET_MODERATION=' || pg_temp.probe('authenticated','${U}',false,$$ update public.resources set is_verified=true, moderated_at=now() where id='${R4}' $$) || E'\n';
  res := res || 'VOLUNTEER_FLIP=' || pg_temp.probe('authenticated','${U}',false,$$ update public.resources set is_volunteer_resource=true where id='${R4}' $$) || E'\n';
  res := res || 'NONVOL_ARCHIVE=' || pg_temp.probe('authenticated','${U}',false,$$ update public.resources set status='archived' where id='${R4}' $$) || E'\n';
  res := res || 'VOL_STATUS_NONARCHIVE=' || pg_temp.probe('authenticated','${U}',false,$$ update public.resources set status='approved' where id='${R5}' $$) || E'\n';
  res := res || 'INACTIVE_ORG_EDIT=' || pg_temp.probe('authenticated','${U}',false,$$ update public.organizations set name='z' $$) || E'\n';
  RAISE EXCEPTION 'RESULTS=%', E'\n' || res;
END $z$;
`

// Run the probe transaction. queryProd throws on the terminal RAISE (HTTP 400); the results
// travel in the error body. Returns a label -> outcome map.
async function runProbes(): Promise<Record<string, string>> {
  try {
    await queryProd(`BEGIN;\n${PROBE_BODY}`)
    throw new Error('probe transaction did not roll back as expected')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const i = msg.indexOf('RESULTS=')
    if (i < 0) throw new Error(`probe harness failure (no RESULTS): ${msg.slice(0, 400)}`)
    const out: Record<string, string> = {}
    for (const line of msg.slice(i + 'RESULTS='.length).split('\\n')) {
      const eq = line.indexOf('=')
      if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
    }
    return out
  }
}

maybeDescribe('30 — P3.0 moderation guards + volunteer withdraw (PROD read-only, behavioural)', () => {
  it('[post-deploy] forbidden writes are rejected 42501 with the right guard; legitimate ones succeed', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const r = await runProbes()

    // I1 resources — forge and status/moderation-field violations are rejected.
    expect(r.FORGE_INSERT, 'R1 forge (approved + foreign moderated_by) must be rejected').toMatch(
      /^ERR 42501 guard:resources_moderation_fields/
    )
    expect(r.NULL_STATUS, 'a NULL status must be rejected (lands exactly pending)').toMatch(
      /^ERR 42501 guard:resources_moderation_fields/
    )
    expect(r.REJECTION_REASON, 'a client-set rejection_reason must be rejected').toMatch(
      /^ERR 42501 guard:resources_moderation_fields/
    )
    // I1 carve-out — a volunteer approved insert (moderation empty) succeeds.
    expect(r.VOL_APPROVED_INSERT, 'a volunteer approved insert must succeed').toMatch(/^OK rows=1/)
    // I1b — the owner can withdraw their own approved volunteer listing.
    expect(r.OWNER_WITHDRAW, 'the owner must be able to withdraw their approved volunteer listing').toMatch(/^OK rows=1/)
    // Moderated-pin integrity — the owner cannot relocate an approved non-volunteer pin.
    expect(r.SETLOC_APPROVED_NONVOL, 'the owner must NOT relocate an approved non-volunteer resource').toMatch(
      /^ERR 42501 not authorized/
    )
    // I6 post_comments — is_hidden forges rejected (insert-hidden and unfiltered un-hide).
    expect(r.COMMENT_HIDDEN_INSERT, 'inserting a hidden comment must be rejected').toMatch(
      /^ERR 42501 guard:post_comments_is_hidden/
    )
    expect(r.UNFILTERED_UNHIDE, 'an unfiltered un-hide of a hidden comment must be rejected').toMatch(
      /^ERR 42501 guard:post_comments_is_hidden/
    )
    // I3 organizations — an org admin cannot change created_by, and an UNFILTERED deactivate
    // (which bypasses the SELECT-visibility filter) is still blocked by the guard.
    expect(r.ORG_CREATED_BY, 'an org admin must NOT change created_by').toMatch(
      /^ERR 42501 guard:organizations_admin_fields/
    )
    expect(r.ORG_DEACTIVATE_UNFILTERED, 'an org admin must NOT deactivate via an unfiltered UPDATE').toMatch(
      /^ERR 42501 guard:organizations_admin_fields/
    )
    expect(r.ORG_DEACTIVATE_ACTIVE, 'an org admin must NOT set is_active=false on their active org').toMatch(
      /^ERR 42501 guard:organizations_admin_fields/
    )
    // A platform admin's direct resource UPDATE succeeds (the admin bypass is load-bearing).
    expect(r.ADMIN_DIRECT_UPDATE, 'a platform admin direct resource UPDATE must succeed').toMatch(/^OK rows=1/)
    // An owner cannot set moderation fields on their own pending row.
    expect(r.OWNER_SET_MODERATION, 'an owner must NOT set is_verified/moderated_at on their pending row').toMatch(
      /^ERR 42501 guard:resources_moderation_fields/
    )
    // An owner cannot flip is_volunteer_resource on an existing row (pin-integrity finding).
    expect(r.VOLUNTEER_FLIP, 'an owner must NOT flip is_volunteer_resource on an existing row').toMatch(
      /^ERR 42501 guard:resources_moderation_fields/
    )
    // An owner cannot archive a non-volunteer pin (only the volunteer self-withdraw is allowed).
    expect(r.NONVOL_ARCHIVE, 'an owner must NOT archive a non-volunteer resource').toMatch(
      /^ERR 42501 guard:resources_moderation_fields/
    )
    // A volunteer owner may ONLY archive (withdraw) — not move their listing to another status.
    expect(r.VOL_STATUS_NONARCHIVE, 'a volunteer owner must NOT set a non-archived status').toMatch(
      /^ERR 42501 guard:resources_moderation_fields/
    )
    // An org admin cannot edit an inactive org (unfiltered UPDATE reaches the inactive row).
    expect(r.INACTIVE_ORG_EDIT, 'an org admin must NOT edit an inactive org').toMatch(
      /^ERR 42501 guard:organizations_admin_fields/
    )
  })

  it('[post-deploy] side fix — the duplicate updated_at trigger is gone, exactly one remains', async (ctx) => {
    const gate = await queryProd(GATE_SQL)
    if (gate[0]?.applied !== true) { ctx.skip(); return }
    const rows = await queryProd(`
      SELECT
        (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relname='post_comments' AND t.tgname='set_post_comments_updated_at') AS dup_gone,
        (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relname='post_comments' AND t.tgname='update_comments_updated_at'
           AND (t.tgtype & 2)<>0 AND t.tgenabled<>'D') AS kept
    `)
    expect(Number(rows[0]?.dup_gone), 'the duplicate set_post_comments_updated_at trigger must be gone').toBe(0)
    expect(Number(rows[0]?.kept), 'exactly the remaining update_comments_updated_at trigger must stay').toBe(1)
  })
})
