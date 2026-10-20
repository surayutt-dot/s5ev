@echo off
chcp 65001 > nul
title MG S5 EV Charging Tracker
echo ========================================================
echo   MG S5 EV Charging Expense Tracker
echo ========================================================
echo.
echo กำลังเปิดเซิร์ฟเวอร์...
echo.
start "" http://localhost:3000
node server.js
pause
