import subprocess, time, re, os, sys, urllib.request

print("=" * 65)
print("     MUN GLOBAL SOLUTIONS SHOWCASE - ONLINE SERVER LAUNCHER")
print("=" * 65)

# Ensure working directory is project root
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Clean up any leftover tunnel.log
if os.path.exists("tunnel.log"):
    try:
        os.remove("tunnel.log")
    except Exception:
        pass

print("[1/2] Dang khoi dong Web Server (Node.js) tren cong 3000...")
server_log = open("server.log", "a", encoding="utf-8", buffering=1)
log_file = open("tunnel.log", "w", encoding="utf-8", buffering=1)

server = subprocess.Popen(["node", "server.js"], stdout=server_log, stderr=server_log)

# Wait for local server to be ready
ready = False
for _ in range(20):
    time.sleep(0.5)
    try:
        with urllib.request.urlopen("http://localhost:3000/api/timer", timeout=1) as resp:
            if resp.status == 200:
                ready = True
                break
    except Exception:
        pass

if not ready:
    print("[WARNING] Server chua phan hoi ngay, dang tiep tuc...")

print("[2/2] Dang tao duong link Online HTTPS qua Cloudflare...")
cf = subprocess.Popen(
    [".\\cloudflared.exe", "tunnel", "--url", "http://localhost:3000"],
    stdout=log_file,
    stderr=subprocess.STDOUT,
    text=True
)

current_public_url = None

def update_links_file(url):
    student_url = f"{url}/student"
    judge_url = f"{url}/judge"
    results_url = f"{url}/results"
    admin_url = f"{url}/admin"

    info = f"""=================================================================
  DA MO THANH CONG! DUONG LINK TRUY CAP TRUC TUYEN:
=================================================================

1. LINK HOC SINH (Students' Choice):
   {student_url}
   -> Gui cho hoc sinh (Moi nuoc nhap mat ma rieng cua doi minh).

2. LINK BAN GIAM KHAO (Judges' Scoring):
   {judge_url}
   -> Mat ma BGK duy nhat: judge2026

3. LINK SAN KHAU / MAY CHIEU (Live Stage):
   {results_url}
   -> Chieu link nay len man hinh hoi truong / may chieu.

4. LINK QUAN TRI VIEN (Admin Panel):
   {admin_url}
   -> Ma PIN quan tri: admin2026
=================================================================
(Luu y: Giu nguyen cua so den nay trong suot su kien de web luon Online)
"""
    with open("ONLINE_LINKS.txt", "w", encoding="utf-8") as f:
        f.write(info)
    print(info)

# Search for initial public link
start_time = time.time()
while time.time() - start_time < 45:
    time.sleep(1)
    if os.path.exists("tunnel.log"):
        with open("tunnel.log", "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            m = re.findall(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
            if m:
                current_public_url = m[-1]
                update_links_file(current_public_url)
                break

if not current_public_url:
    print("[ERROR] Khong the tao duong link Cloudflare. Vui long kiem tra ket noi Internet.")

# Supervisor loop: monitor server, cf, and url changes
try:
    while True:
        time.sleep(3)
        # Check node server
        if server.poll() is not None:
            print("[INFO] Server Node bi ngat, dang khoi dong lai...")
            server = subprocess.Popen(["node", "server.js"], stdout=server_log, stderr=server_log)

        # Check cloudflared
        if cf.poll() is not None:
            print("[INFO] Cloudflared bi ngat, dang khoi dong lai tunnel...")
            log_file = open("tunnel.log", "a", encoding="utf-8", buffering=1)
            cf = subprocess.Popen(
                [".\\cloudflared.exe", "tunnel", "--url", "http://localhost:3000"],
                stdout=log_file,
                stderr=subprocess.STDOUT,
                text=True
            )

        # Monitor tunnel.log for new URLs
        if os.path.exists("tunnel.log"):
            try:
                with open("tunnel.log", "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    matches = re.findall(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
                    if matches and matches[-1] != current_public_url:
                        current_public_url = matches[-1]
                        print("[INFO] Phat hien link tunnel moi:")
                        update_links_file(current_public_url)
            except Exception:
                pass
except KeyboardInterrupt:
    print("\nDang dong may chu...")
    try:
        server.terminate()
        cf.terminate()
    except Exception:
        pass
