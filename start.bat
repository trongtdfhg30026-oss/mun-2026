@echo off
title MUN Showcase Event Server
echo Starting MUN Event Online Server...
echo ----------------------------------------------------
echo Web Hub:        http://localhost:3000
echo Student Vote:   http://localhost:3000/student
echo Judge Scoring:  http://localhost:3000/judge
echo Live Results:   http://localhost:3000/results
echo Admin Panel:    http://localhost:3000/admin (PIN: mun2026)
echo ----------------------------------------------------
node server.js
pause
