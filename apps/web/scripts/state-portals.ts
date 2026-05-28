export interface StatePortal {
  state: string
  stateCode: string
  combinedAppUrl: string | null
  combinedAppName: string | null
  snapAgencyUrl: string | null
  medicaidUrl: string | null
  tanfUrl: string | null
  dhsUrl: string
}

export const STATE_PORTALS: StatePortal[] = [
  { state: 'Alabama', stateCode: 'AL', combinedAppUrl: 'https://www.myalabama.gov/', combinedAppName: 'MyAlabama', snapAgencyUrl: 'https://dhr.alabama.gov/food-assistance/', medicaidUrl: 'https://medicaid.alabama.gov/', tanfUrl: null, dhsUrl: 'https://dhr.alabama.gov/' },
  { state: 'Alaska', stateCode: 'AK', combinedAppUrl: 'https://my.alaska.gov/', combinedAppName: 'myAlaska', snapAgencyUrl: 'https://health.alaska.gov/dpa/', medicaidUrl: 'https://health.alaska.gov/dpa/Pages/medicaid/', tanfUrl: null, dhsUrl: 'https://health.alaska.gov/dpa/' },
  { state: 'Arizona', stateCode: 'AZ', combinedAppUrl: 'https://www.healthearizonaplus.gov/', combinedAppName: 'Health-e-Arizona Plus', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://des.az.gov/' },
  { state: 'Arkansas', stateCode: 'AR', combinedAppUrl: 'https://access.arkansas.gov/', combinedAppName: 'Access Arkansas', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://humanservices.arkansas.gov/' },
  { state: 'California', stateCode: 'CA', combinedAppUrl: 'https://www.benefitscal.com/', combinedAppName: 'BenefitsCal', snapAgencyUrl: null, medicaidUrl: 'https://www.dhcs.ca.gov/services/medi-cal', tanfUrl: null, dhsUrl: 'https://www.cdss.ca.gov/' },
  { state: 'Colorado', stateCode: 'CO', combinedAppUrl: 'https://peak.colorado.gov/', combinedAppName: 'PEAK', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://cdhs.colorado.gov/' },
  { state: 'Connecticut', stateCode: 'CT', combinedAppUrl: 'https://connect.ct.gov/', combinedAppName: 'ConneCT', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://portal.ct.gov/dss' },
  { state: 'Delaware', stateCode: 'DE', combinedAppUrl: 'https://assist.dhss.delaware.gov/', combinedAppName: 'ASSIST', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dhss.delaware.gov/' },
  { state: 'Florida', stateCode: 'FL', combinedAppUrl: 'https://www.myflorida.com/accessflorida/', combinedAppName: 'ACCESS Florida', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.myflfamilies.com/' },
  { state: 'Georgia', stateCode: 'GA', combinedAppUrl: 'https://gateway.ga.gov/', combinedAppName: 'Georgia Gateway', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dhs.georgia.gov/' },
  { state: 'Hawaii', stateCode: 'HI', combinedAppUrl: null, combinedAppName: null, snapAgencyUrl: 'https://humanservices.hawaii.gov/bessd/snap/', medicaidUrl: 'https://medquest.hawaii.gov/', tanfUrl: null, dhsUrl: 'https://humanservices.hawaii.gov/' },
  { state: 'Idaho', stateCode: 'ID', combinedAppUrl: 'https://idalink.idaho.gov/', combinedAppName: 'iDALink', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://healthandwelfare.idaho.gov/' },
  { state: 'Illinois', stateCode: 'IL', combinedAppUrl: 'https://abe.illinois.gov/', combinedAppName: 'ABE (Application for Benefits Eligibility)', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.dhs.state.il.us/' },
  { state: 'Indiana', stateCode: 'IN', combinedAppUrl: 'https://fssabenefits.in.gov/', combinedAppName: 'FSSA Benefits Portal', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.in.gov/fssa/' },
  { state: 'Iowa', stateCode: 'IA', combinedAppUrl: 'https://dhsservices.iowa.gov/', combinedAppName: 'DHS Services', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dhs.iowa.gov/' },
  { state: 'Kansas', stateCode: 'KS', combinedAppUrl: 'https://cssp.kees.ks.gov/', combinedAppName: 'KEES', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.dcf.ks.gov/' },
  { state: 'Kentucky', stateCode: 'KY', combinedAppUrl: 'https://kynect.ky.gov/', combinedAppName: 'kynect', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://chfs.ky.gov/' },
  { state: 'Louisiana', stateCode: 'LA', combinedAppUrl: 'https://cafe-cp.dcfs.la.gov/', combinedAppName: 'CAFE', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.dcfs.louisiana.gov/' },
  { state: 'Maine', stateCode: 'ME', combinedAppUrl: 'https://ams-prd.maine.gov/', combinedAppName: 'My Maine Connection', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.maine.gov/dhhs/' },
  { state: 'Maryland', stateCode: 'MD', combinedAppUrl: 'https://mydhrbenefits.dhr.state.md.us/', combinedAppName: 'myDHR', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dhr.maryland.gov/' },
  { state: 'Massachusetts', stateCode: 'MA', combinedAppUrl: 'https://dtaconnect.eohhs.mass.gov/', combinedAppName: 'DTA Connect', snapAgencyUrl: null, medicaidUrl: 'https://www.mass.gov/masshealth', tanfUrl: null, dhsUrl: 'https://www.mass.gov/orgs/department-of-transitional-assistance' },
  { state: 'Michigan', stateCode: 'MI', combinedAppUrl: 'https://newmibridges.michigan.gov/', combinedAppName: 'MI Bridges', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.michigan.gov/mdhhs' },
  { state: 'Minnesota', stateCode: 'MN', combinedAppUrl: 'https://applymn.dhs.mn.gov/', combinedAppName: 'ApplyMN', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://mn.gov/dhs/' },
  { state: 'Mississippi', stateCode: 'MS', combinedAppUrl: 'https://www.mdhs.ms.gov/economic-assistance/apply/', combinedAppName: null, snapAgencyUrl: null, medicaidUrl: 'https://medicaid.ms.gov/', tanfUrl: null, dhsUrl: 'https://www.mdhs.ms.gov/' },
  { state: 'Missouri', stateCode: 'MO', combinedAppUrl: 'https://mydss.mo.gov/', combinedAppName: 'myDSS', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dss.mo.gov/' },
  { state: 'Montana', stateCode: 'MT', combinedAppUrl: 'https://apply.mt.gov/', combinedAppName: 'Apply Montana', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dphhs.mt.gov/' },
  { state: 'Nebraska', stateCode: 'NE', combinedAppUrl: 'https://dhhs-access-neb.ne.gov/', combinedAppName: 'ACCESSNebraska', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dhhs.ne.gov/' },
  { state: 'Nevada', stateCode: 'NV', combinedAppUrl: 'https://accessnevada.dwss.nv.gov/', combinedAppName: 'Access Nevada', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dwss.nv.gov/' },
  { state: 'New Hampshire', stateCode: 'NH', combinedAppUrl: 'https://nheasy.nh.gov/', combinedAppName: 'NH Easy', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.dhhs.nh.gov/' },
  { state: 'New Jersey', stateCode: 'NJ', combinedAppUrl: 'https://oneapp.dhs.state.nj.us/', combinedAppName: 'NJ OneApp', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.nj.gov/humanservices/' },
  { state: 'New Mexico', stateCode: 'NM', combinedAppUrl: 'https://www.yes.state.nm.us/', combinedAppName: 'YesNM', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.hsd.state.nm.us/' },
  { state: 'New York', stateCode: 'NY', combinedAppUrl: 'https://mybenefits.ny.gov/', combinedAppName: 'myBenefits', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://otda.ny.gov/' },
  { state: 'North Carolina', stateCode: 'NC', combinedAppUrl: 'https://epass.nc.gov/', combinedAppName: 'ePASS', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.ncdhhs.gov/' },
  { state: 'North Dakota', stateCode: 'ND', combinedAppUrl: null, combinedAppName: null, snapAgencyUrl: 'https://www.nd.gov/dhs/services/financialhelp/foodstamps.html', medicaidUrl: 'https://www.nd.gov/dhs/services/medicalserv/medicaid/', tanfUrl: null, dhsUrl: 'https://www.nd.gov/dhs/' },
  { state: 'Ohio', stateCode: 'OH', combinedAppUrl: 'https://benefits.ohio.gov/', combinedAppName: 'Ohio Benefits', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://jfs.ohio.gov/' },
  { state: 'Oklahoma', stateCode: 'OK', combinedAppUrl: 'https://okdhslive.org/', combinedAppName: 'OKDHSLive', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://oklahoma.gov/okdhs.html' },
  { state: 'Oregon', stateCode: 'OR', combinedAppUrl: 'https://one.oregon.gov/', combinedAppName: 'ONE (Oregon Eligibility)', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.oregon.gov/odhs/' },
  { state: 'Pennsylvania', stateCode: 'PA', combinedAppUrl: 'https://www.compass.state.pa.us/', combinedAppName: 'COMPASS', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.dhs.pa.gov/' },
  { state: 'Rhode Island', stateCode: 'RI', combinedAppUrl: 'https://healthyrhode.ri.gov/', combinedAppName: 'HealthyRhode', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dhs.ri.gov/' },
  { state: 'South Carolina', stateCode: 'SC', combinedAppUrl: 'https://scosa.sc.gov/', combinedAppName: 'SC OSA', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dss.sc.gov/' },
  { state: 'South Dakota', stateCode: 'SD', combinedAppUrl: null, combinedAppName: null, snapAgencyUrl: 'https://dss.sd.gov/economicassistance/snap/', medicaidUrl: 'https://dss.sd.gov/medicaid/', tanfUrl: null, dhsUrl: 'https://dss.sd.gov/' },
  { state: 'Tennessee', stateCode: 'TN', combinedAppUrl: 'https://fabenefits.dhs.tn.gov/', combinedAppName: 'FA Benefits', snapAgencyUrl: null, medicaidUrl: 'https://www.tn.gov/tenncare.html', tanfUrl: null, dhsUrl: 'https://www.tn.gov/humanservices.html' },
  { state: 'Texas', stateCode: 'TX', combinedAppUrl: 'https://www.yourtexasbenefits.com/', combinedAppName: 'Your Texas Benefits', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.hhs.texas.gov/' },
  { state: 'Utah', stateCode: 'UT', combinedAppUrl: 'https://jobs.utah.gov/mycase/', combinedAppName: 'myCase', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://jobs.utah.gov/' },
  { state: 'Vermont', stateCode: 'VT', combinedAppUrl: 'https://dcf.vermont.gov/benefits/apply', combinedAppName: 'Vermont Benefits Application', snapAgencyUrl: 'https://dcf.vermont.gov/benefits/3squaresVT', medicaidUrl: 'https://dvha.vermont.gov/members', tanfUrl: 'https://dcf.vermont.gov/benefits/reach-up', dhsUrl: 'https://dcf.vermont.gov/' },
  { state: 'Virginia', stateCode: 'VA', combinedAppUrl: 'https://commonhelp.virginia.gov/', combinedAppName: 'CommonHelp', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.dss.virginia.gov/' },
  { state: 'Washington', stateCode: 'WA', combinedAppUrl: 'https://www.washingtonconnection.org/', combinedAppName: 'Washington Connection', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.dshs.wa.gov/' },
  { state: 'West Virginia', stateCode: 'WV', combinedAppUrl: 'https://dhhr.wv.gov/bcf/Pages/default.aspx', combinedAppName: null, snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dhhr.wv.gov/' },
  { state: 'Wisconsin', stateCode: 'WI', combinedAppUrl: 'https://access.wisconsin.gov/', combinedAppName: 'ACCESS', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://www.dhs.wisconsin.gov/' },
  { state: 'Wyoming', stateCode: 'WY', combinedAppUrl: null, combinedAppName: null, snapAgencyUrl: 'https://dfs.wyo.gov/assistance-programs/food-assistance/', medicaidUrl: 'https://health.wyo.gov/healthcarefin/equalitycare/', tanfUrl: null, dhsUrl: 'https://dfs.wyo.gov/' },
  { state: 'District of Columbia', stateCode: 'DC', combinedAppUrl: 'https://dcbenefits.dhs.dc.gov/', combinedAppName: 'DC Benefits', snapAgencyUrl: null, medicaidUrl: null, tanfUrl: null, dhsUrl: 'https://dhs.dc.gov/' },
]

export function getStatePortal(stateCode: string): StatePortal | undefined {
  return STATE_PORTALS.find(s => s.stateCode === stateCode)
}

export function getStateCodes(): string[] {
  return STATE_PORTALS.map(s => s.stateCode)
}
