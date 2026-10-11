#!/usr/bin/env python3
"""Reviewed blockers after visual inspection of original Jeppesen V2621 source pages.
Do not inject unverified altitude rows into any blocked charts.
"""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]/'web'
p=root/'data'/'cdfa-v2621-v16-qa.json'
q=root/'data'/'cdfa-v2621-v16-remaining42-audit.json'
data=json.loads(p.read_text());audit=json.loads(q.read_text())
info={
328:('MANDATORY_D10_CAT_C_D_CONFLICTS_WITH_CONTINUOUS_FINAL_SLOPE',"RST VOR/DME 112.6; RWY09 elevation -51 ft, airport -37 ft (below sea level), TCH50; D10 1300 mandatory CAT C/D; need category-specific piecewise model.",{'rwyElevationFt':-51,'airportElevationFt':-37,'tchFt':50,'elevationSource':'RUNWAY_THRESHOLD'}),
438:('TCH_RECOVERED_BUT_D8_STEPPED_FINAL_GEOMETRY_UNRESOLVED',"TRN VOR/DME 115.3; chart explicitly says TCH displaced threshold 50 ft, RWY 3934 ft. D8 6700 from header requires final-segment/control-fix reconciliation.",{'rwyElevationFt':3934,'airportElevationFt':3962,'tchFt':50,'elevationSource':'RUNWAY_THRESHOLD'}),
541:('RWY29_MANDATORY_D10_AND_CATEGORY_ALTITUDES_REQUIRE_PIECEWISE_RECONCILIATION',"RAF NDB 260 kHz is procedure reference; RAF DME 112.3 MHz gives D readings. Chart D10 7800 mandatory for applicable category and final 3.04 deg cannot be extended blindly.",{}),
663:('NEGATIVE_ELEVATION_RECOVERED_BUT_D7_D15_STEPPED_GEOMETRY_UNRESOLVED',"GGN VOR/DME117.6, RWY13 -59 ft, airport -28 ft. D7 2300 and D15 5000 exceed single final-angle projection with map-indicated source geometry.",{'rwyElevationFt':-59,'airportElevationFt':-28,'tchFt':50,'elevationSource':'RUNWAY_THRESHOLD'}),
664:('NEGATIVE_ELEVATION_RECOVERED_BUT_D7_D15_STEPPED_GEOMETRY_UNRESOLVED',"GGN VOR/DME117.6, RWY13 -59 ft, airport -28 ft; CAT C/D arrival distinct. Need verify chart DME-offset and published stepdown geometry, not a single 3.03deg extension.",{'rwyElevationFt':-59,'airportElevationFt':-28,'tchFt':50,'elevationSource':'RUNWAY_THRESHOLD'}),
665:('NEGATIVE_ELEVATION_RECOVERED_BUT_D5_D15_STEPPED_GEOMETRY_UNRESOLVED',"GGN VOR/DME117.6, RWY13 -59 ft, airport -28 ft; D5 1600, D15 5000 cannot be authorized by a one-slope extension without verifying station placement and constraints.",{'rwyElevationFt':-59,'airportElevationFt':-28,'tchFt':50,'elevationSource':'RUNWAY_THRESHOLD'}),
682:('TCH_NOT_PUBLISHED_OR_NOT_ESTABLISHED_ON_RWY30_AND_DME_OFFSET_UNVERIFIED',"RSR NDB332 and RSR VOR/DME115.5 separate. Airport elevation -66 ft recovered. Do not invent TCH 50 where chart does not specify a defensible value.",{'rwyElevationFt':None,'airportElevationFt':-66,'tchFt':None,'elevationSource':'AIRPORT_ELEVATION_FALLBACK_QA'}),
683:('TCH_NOT_PUBLISHED_OR_NOT_ESTABLISHED_ON_RWY30_AND_DME_OFFSET_UNVERIFIED',"RSR NDB332 and RSR VOR/DME115.5 separate. Airport elevation -66 ft recovered; TCH still unresolved.",{'rwyElevationFt':None,'airportElevationFt':-66,'tchFt':None,'elevationSource':'AIRPORT_ELEVATION_FALLBACK_QA'}),
716:('TCH_NOT_EXTRACTED_FOR_NDB_LAM_FINAL',"LAM NDB346 is procedure reference and LAM VOR/DME117.0 gives numeric DME; TCH of this chart still not established. A missing angle could use user default 3deg only AFTER TCH is known.",{}),
991:('NAMED_FIX_KISPE_D5_4_AND_INTERMEDIATE_STEPS_NOT_FITTED',"BGD VOR/DME112.9; KISPE D5.4 at 2100 ft and FIDIX 3600 / intervening altitude constraints. Need segment geometry before computing threshold-based CDFA.",{}),
992:('NAMED_FIX_VINNU_D8_7_AND_HIBUT_D3_5_REQUIRE_PIECEWISE_GEOMETRY',"BGD VOR/DME112.9; VINNU D8.7 at 2100 ft, HIBUT D3.5 and SEBIE D15 intermediate constraints; station offset not verified.",{}),
1019:('NAMED_FIX_CEPKI_D8_7_AND_ZEGIP_D3_3_REQUIRE_PIECEWISE_GEOMETRY',"BSR VOR/DME112.3; CEPKI D8.7 at 1900 ft, ZEGIP D3.3; two separate final-altitude portions need reconciliation.",{}),
1020:('NAMED_FIX_CEPOK_D5_0_AND_OTHER_STEPDOWN_GEOMETRY_UNRESOLVED',"BSR VOR/DME112.3; CEPOK D5 at 1800 ft, other constraints and 2.83deg published descent; no independent station-to-threshold offset.",{}),
1034:('FS13_FAF_NOT_STORED_AS_EXPLICIT_SUL_DME_POINT',"SUL VOR/DME117.0; final start FS13 6500 ft is published with distance-to-threshold information, not a verified numeric SUL DME anchor; geometry needs conversion.",{}),
1035:('FS31_FAF_NOT_STORED_AS_EXPLICIT_SUL_DME_POINT',"SUL VOR/DME117.0; final start FS31 6500 ft and MAP D3.5; require distance-to-threshold versus DME separation.",{}),
1155:('DUAL_VOR_NDB_PROCEDURE_AND_DME_BRANCH_REVERSAL',"Dual VOR Z / NDB Z RWY21C: BUK VOR114.3 + BUK NDB425. DME reverses around station near runway; simple one-branch signed offset is not adequate.",{})
}
assert len(info)==16
seen=0
for c in data['charts']:
 if c['status']!='WITHHELD_MISSING_GEOMETRY':continue
 assert c['sourcePage'] in info,(c['sourcePage'],'unrecognized')
 blocker,note,ex=info[c['sourcePage']]
 c['blockers']=[blocker]
 c['qaWarnings']=[note,'No numeric CDFA table generated; station geometry and/or source elevation not sufficiently established.']
 c['sourceExtracted']={**(c.get('sourceExtracted') or {}),**ex}
 c['isOriginalPageInspected']=True
 c['headerReview']={'source':'Jeppesen 2621 PDF manual visual check','reviewed':True,'detail':note}
 seen+=1
assert seen==16
for c in audit['unresolved']:
 b,n,ex=info[c['page']];c['currentBlockers']=[b];c['visualReviewNote']=n
p.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
q.write_text(json.dumps(audit,indent=2,ensure_ascii=False)+'\n')
print('Annotated remaining:',seen,' QA:',len([c for c in data['charts'] if c['status']=='QA_HEADER_REFERENCE_GEOMETRY_MODEL_V16']))