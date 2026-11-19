/** Local-only structural test fixture. Never a PaidRecord or outbound payload.
 * No network/store dependencies, no original intake, no customer geography.
 * Real handoff guards quarantine its explicit provenance and synthetic marker.
 */
import { syntheticRecord } from './safety'
export function sandboxValidationFixture() {
  return Object.freeze({
    fixture_kind:'LOCAL_SYNTHETIC_VALIDATION_ONLY' as const,
    service_area:'SYNTHETIC TEST: local fixture, not business geography',
    service_area_correction:Object.freeze({synthetic_test_value:true,source:'local_unit_fixture'}),
    permitted_operations:Object.freeze(['local_structure_validation'] as const),
  })
}
export function validateSandboxFixture(input:unknown) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('INVALID_FIXTURE')
  const r=input as Record<string,unknown>
  if(Object.keys(r).sort().join(',')!=='fixture_kind,permitted_operations,service_area,service_area_correction' || r.fixture_kind!=='LOCAL_SYNTHETIC_VALIDATION_ONLY' || r.service_area!=='SYNTHETIC TEST: local fixture, not business geography' || !syntheticRecord(r))throw new Error('INVALID_FIXTURE')
  const provenance=r.service_area_correction as Record<string,unknown>|undefined
  if(!provenance || provenance.synthetic_test_value!==true || provenance.source!=='local_unit_fixture' || Object.keys(provenance).length!==2 || !Array.isArray(r.permitted_operations) || r.permitted_operations.length!==1 || r.permitted_operations[0]!=='local_structure_validation')throw new Error('INVALID_FIXTURE')
  // This result does not satisfy audit, payment, Routine or report acceptance.
  return {result:'LOCAL_FIXTURE_VALIDATED' as const,real_assessment_eligible:false as const,outbound_eligible:false as const}
}
