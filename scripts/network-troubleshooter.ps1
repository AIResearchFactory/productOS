param(
  [string]$OutDir = "C:\Users\User\.openclaw\workspace\diagnostics\network",
  [string]$PingTarget = "1.1.1.1",
  [string]$DnsTestDomain = "www.microsoft.com",
  [switch]$IncludeTraceroute
)

$ErrorActionPreference = 'Continue'
$now = Get-Date
$stamp = $now.ToString('yyyyMMdd-HHmmss')
$runDir = Join-Path $OutDir "run-$stamp"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Save-Text($name, $text) {
  $path = Join-Path $runDir $name
  $text | Out-File -FilePath $path -Encoding utf8
  return $path
}

function Run-Cmd($name, $scriptBlock) {
  try {
    $result = & $scriptBlock 2>&1 | Out-String
  } catch {
    $result = "ERROR: $($_.Exception.Message)"
  }
  Save-Text "$name.txt" $result | Out-Null
  return $result
}

# Collect raw diagnostics
$ipconfig = Run-Cmd "01-ipconfig-all" { ipconfig /all }
$wlanInterfaces = Run-Cmd "02-netsh-wlan-interfaces" { netsh wlan show interfaces }
$wlanDrivers = Run-Cmd "03-netsh-wlan-drivers" { netsh wlan show drivers }
$wlanProfiles = Run-Cmd "04-netsh-wlan-profiles" { netsh wlan show profiles }
$routes = Run-Cmd "05-route-print" { route print }
$netAdapters = Run-Cmd "06-get-netadapter" { Get-NetAdapter | Format-Table -Auto Name, InterfaceDescription, Status, LinkSpeed, MacAddress }
$netAdapterAdvanced = Run-Cmd "07-get-netadapteradvancedproperty" { Get-NetAdapterAdvancedProperty -Name "*" | Format-Table -Auto Name, DisplayName, DisplayValue }
$power = Run-Cmd "08-powercfg-wireless" { powercfg /q }
$tcp = Run-Cmd "09-netsh-int-tcp" { netsh int tcp show global }
$dnsClient = Run-Cmd "10-get-dnsclientserveraddress" { Get-DnsClientServerAddress | Format-Table -Auto InterfaceAlias, AddressFamily, ServerAddresses }

$pingResult = Run-Cmd "11-ping" { ping -n 20 $PingTarget }
$dnsResolveResult = Run-Cmd "12-resolve-dns" { Resolve-DnsName $DnsTestDomain }

if ($IncludeTraceroute) {
  Run-Cmd "13-tracert" { tracert -d $PingTarget } | Out-Null
}

# Optional WLAN report (HTML)
try {
  netsh wlan show wlanreport | Out-Null
  $wlanReportSrc = "C:\ProgramData\Microsoft\Windows\WlanReport\wlan-report-latest.html"
  if (Test-Path $wlanReportSrc) {
    Copy-Item $wlanReportSrc (Join-Path $runDir "wlan-report-latest.html") -Force
  }
} catch {}

# Heuristic analysis
$findings = @()
$score = 0

if ($wlanInterfaces -match 'Signal\s*:\s*(\d+)%') {
  $signal = [int]$matches[1]
  if ($signal -lt 50) {
    $findings += "Weak Wi-Fi signal ($signal%). This can cause slow speed and unstable/slow connection setup."
    $score += 3
  } elseif ($signal -lt 70) {
    $findings += "Moderate Wi-Fi signal ($signal%). Performance may degrade under load."
    $score += 1
  }
}

if ($wlanInterfaces -match 'Radio type\s*:\s*(.+)') {
  $radio = $matches[1].Trim()
  if ($radio -match '802\.11n') {
    $findings += "Connected on 802.11n (older/typically slower than ac/ax)."
    $score += 2
  }
}

if ($pingResult -match 'Average = (\d+)ms') {
  $avgPing = [int]$matches[1]
  if ($avgPing -gt 120) {
    $findings += "High average latency to $PingTarget ($avgPing ms)."
    $score += 3
  } elseif ($avgPing -gt 60) {
    $findings += "Moderate latency to $PingTarget ($avgPing ms)."
    $score += 1
  }
}

if ($pingResult -match '(\d+)% loss') {
  $loss = [int]$matches[1]
  if ($loss -gt 0) {
    $findings += "Packet loss detected ($loss%). This strongly correlates with slowness and lag."
    $score += 4
  }
}

if ($ipconfig -notmatch 'Default Gateway') {
  $findings += "No default gateway detected in ipconfig output."
  $score += 4
}

if ($dnsResolveResult -match 'ERROR|Exception|NXDOMAIN|SERVFAIL') {
  $findings += "DNS resolution issues detected when resolving $DnsTestDomain."
  $score += 3
}

if ($wlanDrivers -match 'Hosted network supported\s*:\s*No') {
  $findings += "Driver is missing some capabilities; consider driver update from OEM site."
  $score += 1
}

$summaryLevel = if ($score -ge 8) { 'HIGH likelihood of local Wi-Fi/network issues' } elseif ($score -ge 4) { 'MEDIUM likelihood of local Wi-Fi/network issues' } else { 'LOW/MIXED likelihood - may be ISP/router-side or intermittent' }

if ($findings.Count -eq 0) {
  $findings += "No obvious local bottleneck detected by heuristics. Next step: compare with another device on same Wi-Fi and run router/ISP checks."
}

$recommendations = @(
  "Restart router and this PC; re-test.",
  "Update Wi-Fi adapter driver from laptop/adapter manufacturer (not only Windows Update).",
  "Prefer 5GHz/6GHz SSID and move closer to AP to improve signal.",
  "Disable VPN/proxy temporarily and compare latency/speed.",
  "Set Power Plan to Balanced/High Performance; ensure wireless adapter power saving is not aggressive.",
  "Run this utility during 'good' and 'bad' periods and diff outputs."
)

$report = @"
# Network Troubleshooter Report

- Run time: $($now.ToString('yyyy-MM-dd HH:mm:ss'))
- Computer: $env:COMPUTERNAME
- User: $env:USERNAME
- Ping target: $PingTarget
- DNS test domain: $DnsTestDomain

## Heuristic Summary
$summaryLevel

## Findings
$($findings | ForEach-Object { "- $_" } | Out-String)

## Recommended Next Steps
$($recommendations | ForEach-Object { "- $_" } | Out-String)

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
"@

$reportPath = Join-Path $runDir "REPORT.md"
$report | Out-File -FilePath $reportPath -Encoding utf8

Write-Host "Network troubleshooting bundle generated: $runDir" -ForegroundColor Green
Write-Host "Primary report: $reportPath" -ForegroundColor Yellow
