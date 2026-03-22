🛡️ Suricata Setup Guide (Windows)

⚠️ Note: Suricata runs best on Linux.
On Windows, we use WSL (Windows Subsystem for Linux).

1️⃣ Install WSL (Ubuntu)

Open PowerShell as Admin:

wsl --install

Restart your system if prompted.

2️⃣ Open Ubuntu (WSL)

Search “Ubuntu” in Start Menu and open it.

3️⃣ Install Suricata
sudo apt update
sudo apt install -y suricata
4️⃣ Find your network interface
ip a

Look for:

eth0
wlan0
ens33
5️⃣ Configure Suricata

Edit config:

sudo nano /etc/suricata/suricata.yaml

Update:

af-packet:
  - interface: eth0   # change if needed

outputs:
  - eve-log:
      enabled: yes
      filetype: regular
      filename: /var/log/suricata/eve.json
      types:
        - alert
        - stats

Save:

CTRL + X → Y → Enter
6️⃣ Update Rules
sudo suricata-update
7️⃣ Start Suricata
sudo service suricata start
sudo service suricata status
8️⃣ Watch alerts live
sudo tail -f /var/log/suricata/eve.json
9️⃣ Test alerts
curl http://testmynids.org/uid/index.html
🔗 Connect with Backend (Windows)

Now go back to PowerShell (Windows):

1️⃣ Activate backend venv
cd C:\Users\megha\OneDrive\Netraith
.\venv\Scripts\Activate
2️⃣ Set Suricata log path

👉 WSL files are accessed via:

\\wsl$\Ubuntu\var\log\suricata\eve.json

Set environment variable:

$env:SURICATA_LOG_PATH="\\wsl$\Ubuntu\var\log\suricata\eve.json"
3️⃣ Run backend
cd backend
python app.py
🌐 Access
Backend → http://localhost:5000
Frontend → http://localhost:5173
⚡ Without Suricata (Demo Mode)

If Suricata is not running, you can still test:

POST /api/simulate/<attack_type>

Examples:

/api/simulate/sql_injection
/api/simulate/ddos