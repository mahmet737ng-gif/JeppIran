"""V2 landmark fit regression tests. Synthetic coordinates are never live data."""
import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from georef_engine_v2 import fit_landmark_region
RECT={"left":0,"top":0,"right":612,"bottom":792}
LAT,LON=33.4383333333,48.28
EARTH=111319.49079327358

def samples():
    out=[]
    for i,(e,n) in enumerate(((0,0),(3100,0),(0,4000),(3500,3700))):
        out.append({"id":"T"+str(i),"lat":LAT+n/EARTH,
                    "lon":LON+e/(EARTH*math.cos(math.radians(LAT))),
                    "x":115+0.025*e+0.008*n,
                    "y":455+0.008*e-0.025*n,
                    "sourceRef":"PUBLISHED_AIP_"+str(i%2),
                    "pdfMarkerText":"T"+str(i),
                    "role":"holdout" if i==3 else "training"})
    return out

class V2ControlsTest(unittest.TestCase):
    def test_four_landmarks_and_independent_holdout(self):
        model=fit_landmark_region(samples(),RECT,[])
        self.assertEqual(model["holdoutCount"],1)
        self.assertLess(model["independentResidualPdfPoints"],0.001)
    def test_two_landmarks_not_enough(self):
        with self.assertRaisesRegex(ValueError,"four independent"):
            fit_landmark_region(samples()[:2],RECT,[])
    def test_holdout_error_detected(self):
        c=samples();c[-1]["x"]+=8
        with self.assertRaisesRegex(ValueError,"residual"):
            fit_landmark_region(c,RECT,[])
    def test_inside_inset_refused(self):
        mask={"left":110,"top":450,"right":120,"bottom":460}
        with self.assertRaisesRegex(ValueError,"inside an inset"):
            fit_landmark_region(samples(),RECT,[mask])
    def test_no_source_ref_refused(self):
        c=samples();c[2].pop("sourceRef")
        with self.assertRaisesRegex(ValueError,"sourceRef"):
            fit_landmark_region(c,RECT,[])
    def test_duplicate_landmark_rejected(self):
        c=samples();c[1]["id"]=c[0]["id"]
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            fit_landmark_region(c,RECT,[])
    def test_bad_scale_rejected(self):
        c=samples()
        for x in c:
            x["x"]=100+(x["x"]-115)*0.001
            x["y"]=400+(x["y"]-455)*0.001
        with self.assertRaisesRegex(ValueError,"scale"):
            fit_landmark_region(c,RECT,[])
if __name__=="__main__":unittest.main()
