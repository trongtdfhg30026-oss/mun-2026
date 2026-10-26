import subprocess, time, re, os, sys, webbrowser

print("="*65)
print("   MODEL UNITED NATIONS (MUN) - GLOBAL SOLUTIONS SHOWCASE")
print("           ONLINE CLOUD LAUNCHER & SECURITY GATE")
print("="*65)

# 1. Start Node.js server
print("[1/2] Starting Node.js backend server on port 3000...")
server = subprocess.Popen(["node", "server.js"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

time.sleep(1.5)

# 2. Start Cloudflare Tunnel
print("[2/2] Establishing encrypted public HTTPS tunnel via Cloudflare...")
cf = subprocess.Popen([".\\cloudflared.exe", "tunnel", "--url", "http://localhost:3000"], stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)

public_url = None
start_time = time.time()
while time.time() - start_time < 30:
    line = cf.stderr.readline()
    if line:
        m = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if m:
            public_url = m.group(0)
            break

if not public_url:
    print("Could not retrieve Cloudflare URL. Please ensure your computer is connected to the internet.")
    server.terminate()
    cf.terminate()
    sys.exit(1)

student_url = f"{public_url}/student"
judge_url = f"{public_url}/judge?key=judge2026"
results_url = f"{public_url}/results"
admin_url = f"{public_url}/admin"

print("\n" + "="*65)
print("🎉 YOUR MUN WEB PLATFORM IS LIVE & ACCESSIBLE WORLDWIDE ONLINE!")
print("="*65)
print(f"\n🏛️  EVENT PORTAL HUB:      {public_url}")
print(f"\n🗳️  STUDENTS ONLY LINK:    {student_url}")
print("    -> Share this with all 6 student country delegations.")
print("    -> Self-voting is blocked. Exactly 2 votes required.")
print("    -> Students CANNOT enter the judge chamber from this link!")
print(f"\n⚖️  JUDGES ONLY LINK:      {judge_url}")
print("    -> Share this ONLY with Faculty Adjudicators & SG Mentors.")
print("    -> Direct authentication with key=judge2026.")
print("    -> If opened without passcode, students are locked out!")
print(f"\n📊 LIVE STAGE LEADERBOARD: {results_url}")
print("    -> Open this on the auditorium projector / stage screen.")
print("    -> Real-time 3s auto-sync between student votes & judge scores.")
print(f"\n⚙️  ADMIN & QR CODES:      {admin_url}")
print("    -> Passcode: mun2026")
print("    -> Live QR codes for smartphones to scan in the hall.")
print("="*65 + "\n")

# Save URLs to a text file for quick copy-paste
with open("ONLINE_LINKS.txt", "w", encoding="utf-8") as f:
    f.write("=== MUN GLOBAL SOLUTIONS SHOWCASE - ONLINE LINKS ===\n\n")
    f.write(f"PUBLIC HUB:       {public_url}\n\n")
    f.write(f"STUDENT BALLOT:   {student_url}\n")
    f.write("  * Share with student teams (China, South Africa, South Korea, Russia, Japan, France)\n")
    f.write("  * Blocked from accessing judge chamber\n\n")
    f.write(f"JUDGE CHAMBER:    {judge_url}\n")
    f.write("  * Share only with faculty judges (Passcode: judge2026)\n\n")
    f.write(f"STAGE PROJECTOR:  {results_url}\n")
    f.write("  * Live sync projector view\n\n")
    f.write(f"ADMIN CONTROL:    {admin_url}\n")
    f.write("  * Admin PIN: mun2026\n")

print("Created ONLINE_LINKS.txt with all links saved for convenience.")
print("\n[!] Keep this window open during the school event to keep the site online.")
print("Press Ctrl+C to stop the server when the event is finished.\n")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nStopping server and tunnel...")
    server.terminate()
    cf.terminate()
    print("Done.")