# Network Troubleshooter Report

- Run time: 2026-03-15 22:49:54
- Computer: DESKTOP-1032952
- User: User
- Ping target: 1.1.1.1
- DNS test domain: www.microsoft.com

## Heuristic Summary
LOW/MIXED likelihood - may be ISP/router-side or intermittent

## Findings
- Driver is missing some capabilities; consider driver update from OEM site.


## Recommended Next Steps
- Restart router and this PC; re-test.
- Update Wi-Fi adapter driver from laptop/adapter manufacturer (not only Windows Update).
- Prefer 5GHz/6GHz SSID and move closer to AP to improve signal.
- Disable VPN/proxy temporarily and compare latency/speed.
- Set Power Plan to Balanced/High Performance; ensure wireless adapter power saving is not aggressive.
- Run this utility during 'good' and 'bad' periods and diff outputs.


## Raw Artifacts
- 01-ipconfig-all.txt
- 02-netsh-wlan-interfaces.txt
- 03-netsh-wlan-drivers.txt
- 04-netsh-wlan-profiles.txt
- 05-route-print.txt
- 06-get-netadapter.txt
- 07-get-netadapteradvancedproperty.txt
- 08-powercfg-wireless.txt
- 09-netsh-int-tcp.txt
- 10-get-dnsclientserveraddress.txt
- 11-ping.txt
- 12-resolve-dns.txt
- wlan-report-latest.html (if generated)
