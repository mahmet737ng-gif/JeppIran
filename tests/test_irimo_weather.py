import datetime as dt
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
from irimo_weather import extract, is_current, UTC

SAMPLE = """<div id="stat_info_588_OIAW" style="display:none"><div class="headerTooltip">OIAW-Ahvaz</div>
<div class="bodytooltip">TAF OIAW 201100Z 2012/2118 32005KT 7000 NSC
 TEMPO 2012/2024 32016G22KT 4000 SA FEW035CB SCT040 BKN100
 PROB30 TS/RA SCT030CB SCT035 BKN1000
 TEMPO 2112/2118 32018G24KT 4000 SA FEW030CB SCT035 BKN1000</div>
</div>
<div id="stat_info_601_OIAW" style="display:none"><div class="headerTooltip">OIAW-Ahvaz</div>
<div class="bodytooltip">METAR OIAW 201530Z 36006KT CAVOK 31/09 Q1014</div></div>"""


class IRIMOTests(unittest.TestCase):
    def test_extract_from_real_html_shape(self):
        self.assertEqual(extract(SAMPLE, "metar")["OIAW"], "METAR OIAW 201530Z 36006KT CAVOK 31/09 Q1014")
        taf = extract(SAMPLE, "taf")["OIAW"]
        self.assertIn("BKN1000", taf)  # Preserve source exactly, do not fix suspected typos.
        self.assertIn("PROB30 TS/RA", taf)

    def test_expiry(self):
        now = dt.datetime(2026, 10, 20, 15, 38, tzinfo=UTC)
        self.assertTrue(is_current("metar", extract(SAMPLE, "metar")["OIAW"], now))
        self.assertTrue(is_current("taf", extract(SAMPLE, "taf")["OIAW"], now))
        old = dt.datetime(2026, 10, 25, 12, 0, tzinfo=UTC)
        self.assertFalse(is_current("metar", extract(SAMPLE, "metar")["OIAW"], old))
        self.assertFalse(is_current("taf", extract(SAMPLE, "taf")["OIAW"], old))

    def test_station_isolation(self):
        wrong = SAMPLE.replace("METAR OIAW", "METAR OIII")
        self.assertNotIn("OIAW", extract(wrong, "metar"))


if __name__ == "__main__":
    unittest.main()
