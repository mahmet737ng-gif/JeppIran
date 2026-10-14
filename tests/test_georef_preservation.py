"""No chart reference may be removed, overridden, or copied to a new AIRAC silently."""
import copy,hashlib,json,tempfile,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from georef_preservation import GeorefProtectionError,verify_additive,protect_migration,archive_path_for

def model(page):
    return dict(page=page,airport="OICI" if page!=432 else "OIII",
      chartKey=f"CHART-{page}",sourceFingerprint="a"*64,
      points=[dict(lat=33+i,lon=46+i,x=i,y=i) for i in range(4)])

def asset(pages=(207,209,211,432),sha="a"*64,cycle="V2621"):
    return dict(version=2,coordinateSystem="WGS84",coordinateSpace="pdf_points",
       origin="top_left",source=dict(sha256=sha,pageCount=1654,chartDataVersion=cycle),
       charts=[model(p) for p in pages])

class OwnerLockedGeoreferences(unittest.TestCase):
    def test_only_addition_allowed(self):
        a=asset();b=copy.deepcopy(a);b["charts"].append(model(214))
        self.assertEqual(verify_additive(a,b)["oldPreserved"],4)
    def test_no_existing_reference_may_be_deleted(self):
        for p in (207,209,211,432):
            with self.subTest(p=p),self.assertRaisesRegex(GeorefProtectionError,"DELETED"):
                verify_additive(asset(),asset(tuple(x for x in (207,209,211,432) if x!=p)))
    def test_no_existing_reference_may_be_modified(self):
        a=asset()
        for key in ("points","sourceFingerprint"):
            b=copy.deepcopy(a)
            if key=="points":b["charts"][0]["points"][0]["x"]=99
            else:b["charts"][0][key]="b"*64
            with self.assertRaisesRegex(GeorefProtectionError,"OVERWRITTEN"):
                verify_additive(a,b)
    def test_duplicate_page_rejected(self):
        with self.assertRaisesRegex(GeorefProtectionError,"duplicate"):
            verify_additive(asset(),asset((207,207)))
    def test_airac_change_needs_immutable_archive(self):
        old=json.dumps(asset());new=json.dumps(asset((207,),sha="b"*64,cycle="V2622"))
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(GeorefProtectionError,"not archived"):
                protect_migration(old,new,d)
            p=archive_path_for(old,d);p.write_text(old)
            self.assertTrue(protect_migration(old,new,d)["oldMapsNotReusedWithoutSourceQA"])
            p.write_text(old+" ")
            with self.assertRaisesRegex(GeorefProtectionError,"damaged"):
                protect_migration(old,new,d)

if __name__=="__main__": unittest.main()
