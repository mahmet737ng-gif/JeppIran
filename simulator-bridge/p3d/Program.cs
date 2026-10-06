using System;
using System.Globalization;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using LockheedMartin.Prepar3D.SimConnect;

namespace JeppIran.P3DBridge
{
    internal sealed class BridgeForm : Form
    {
        private const int WM_USER_SIMCONNECT = 0x0402;
        private readonly string target;
        private readonly int port;
        private readonly UdpClient udp = new UdpClient();
        private SimConnect simconnect;

        private enum Definitions { Aircraft }
        private enum Requests { Aircraft }

        [StructLayout(LayoutKind.Sequential, Pack = 1)]
        private struct AircraftData
        {
            public double Latitude;
            public double Longitude;
            public double AltitudeMeters;
            public double HeadingTrue;
        }

        public BridgeForm(string target, int port)
        {
            this.target = target;
            this.port = port;
            ShowInTaskbar = false;
            WindowState = FormWindowState.Minimized;
            Opacity = 0;
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            simconnect = new SimConnect("JEPPIRAN P3D Bridge", Handle, WM_USER_SIMCONNECT, null, 0);
            simconnect.OnRecvSimobjectData += OnAircraftData;
            simconnect.AddToDataDefinition(Definitions.Aircraft, "PLANE LATITUDE", "degrees", SIMCONNECT_DATATYPE.FLOAT64, 0, SimConnect.SIMCONNECT_UNUSED);
            simconnect.AddToDataDefinition(Definitions.Aircraft, "PLANE LONGITUDE", "degrees", SIMCONNECT_DATATYPE.FLOAT64, 0, SimConnect.SIMCONNECT_UNUSED);
            simconnect.AddToDataDefinition(Definitions.Aircraft, "PLANE ALTITUDE", "meters", SIMCONNECT_DATATYPE.FLOAT64, 0, SimConnect.SIMCONNECT_UNUSED);
            simconnect.AddToDataDefinition(Definitions.Aircraft, "PLANE HEADING DEGREES TRUE", "degrees", SIMCONNECT_DATATYPE.FLOAT64, 0, SimConnect.SIMCONNECT_UNUSED);
            simconnect.RegisterDataDefineStruct<AircraftData>(Definitions.Aircraft);
            simconnect.RequestDataOnSimObject(Requests.Aircraft, Definitions.Aircraft, SimConnect.SIMCONNECT_OBJECT_ID_USER, SIMCONNECT_PERIOD.SECOND, SIMCONNECT_DATA_REQUEST_FLAG.DEFAULT, 0, 0, 0);
            Console.WriteLine("JEPPIRAN bridge -> " + target + ":" + port);
        }

        private void OnAircraftData(SimConnect sender, SIMCONNECT_RECV_SIMOBJECT_DATA data)
        {
            if ((Requests)data.dwRequestID != Requests.Aircraft || data.dwData.Length == 0) return;
            var x = (AircraftData)data.dwData[0];
            var json = string.Format(CultureInfo.InvariantCulture,
                "{{\"lat\":{0:R},\"lon\":{1:R},\"alt\":{2:R},\"heading\":{3:R}}}",
                x.Latitude, x.Longitude, x.AltitudeMeters, x.HeadingTrue);
            var bytes = Encoding.UTF8.GetBytes(json);
            udp.Send(bytes, bytes.Length, target, port);
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_USER_SIMCONNECT && simconnect != null) simconnect.ReceiveMessage();
            base.WndProc(ref m);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (simconnect != null) simconnect.Dispose();
                udp.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            if (args.Length < 1)
            {
                Console.Error.WriteLine("Usage: JeppIran.P3DBridge.exe <ANDROID_IP> [UDP_PORT]");
                return;
            }
            int parsed;
            var port = args.Length > 1 && int.TryParse(args[1], out parsed) ? parsed : 49011;
            Application.EnableVisualStyles();
            Application.Run(new BridgeForm(args[0], port));
        }
    }
}
