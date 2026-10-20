import datetime as dt
import pathlib
import sys
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"scripts"))
from refresh_iran_taf import build_rows, taf_details, UTC
NOW=dt.datetime(2026,10,20,16,0,tzinfo=UTC)
OIAW=("TAF OIAW 201100Z 2012/2118 32005KT 7000 NSC "
      "TEMPO 2012/2024 32016G22KT 4000 SA FEW035CB SCT040 BKN100 "
      "PROB30 TS/RA SCT030CB SCT035 BKN1000")
OIII="TAF OIII 201100Z 2012/2118 22006KT 9000 NSC"
class CacheTests(unittest.TestCase):
    def test_prefers_irimo_and_preserves_raw(self):
        rows,n=build_rows({"OIAW":{"taf":OIAW},"OIII":{"taf":OIII}},
                          {"OIAW","OIII"},{"OIAW":OIAW},NOW)
        self.assertEqual(n,1)
        self.assertEqual(rows["OIAW"]["raw"],OIAW)
        self.assertEqual(rows["OIAW"]["source"],"IRIMO")
        self.assertEqual(rows["OIII"]["source"],"NOAA")
    def test_expired_never_republished_as_current(self):
        rows,_=build_rows({"OIAW":{"taf":OIAW}},{"OIAW","OIII"},{},NOW+dt.timedelta(days=7))
        self.assertEqual(rows["OIAW"]["status"],"unavailable")
        self.assertEqual(rows["OIAW"]["raw"],"")
        self.assertEqual(rows["OIII"]["raw"],"")
    def test_taf_issue_and_validity(self):
        stamp=taf_details(OIAW,NOW)
        self.assertEqual(stamp[0],"2026-10-20T11:00:00+00:00")
        self.assertEqual(stamp[2],"2026-10-21T18:00:00+00:00")
if __name__=="__main__":unittest.main()
