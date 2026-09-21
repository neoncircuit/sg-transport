# Export the TLS chain for datamall2.mytransport.sg into .local/corp-ca.pem
# so Node can set NODE_EXTRA_CA_CERTS (Windows corporate MITM / custom roots).
# Usage: powershell -File scripts/export-corp-ca.ps1

$ErrorActionPreference = "Stop"
$hostName = if ($env:LTA_TLS_HOST) { $env:LTA_TLS_HOST } else { "datamall2.mytransport.sg" }

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot ".local"
$outFile = Join-Path $outDir "corp-ca.pem"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$tcp = New-Object System.Net.Sockets.TcpClient
$tcp.ReceiveTimeout = 15000
$tcp.SendTimeout = 15000
$tcp.Connect($hostName, 443)
try {
  $ssl = New-Object System.Net.Security.SslStream(
    $tcp.GetStream(),
    $false,
    { param($s, $c, $ch, $e) $true }
  )
  $ssl.AuthenticateAsClient($hostName)
  $leaf = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
  $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
  [void]$chain.Build($leaf)

  $pemParts = New-Object System.Collections.Generic.List[string]
  foreach ($el in $chain.ChainElements) {
    $cert = $el.Certificate
    # Skip the leaf - Node needs the issuer / intermediates / root.
    if ($cert.Thumbprint -eq $leaf.Thumbprint) { continue }
    $raw = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $b64 = [Convert]::ToBase64String($raw, [System.Base64FormattingOptions]::InsertLineBreaks)
    $pemParts.Add("-----BEGIN CERTIFICATE-----`r`n$b64`r`n-----END CERTIFICATE-----")
  }
  $ssl.Dispose()

  if ($pemParts.Count -eq 0) {
    throw "No issuer certificates in chain - is the host using a public CA Node already trusts?"
  }

  ($pemParts -join "`r`n`r`n") + "`r`n" | Set-Content -Path $outFile -Encoding ascii
  Write-Host "Wrote $($pemParts.Count) cert(s) to $outFile"
  Write-Host "Set NODE_EXTRA_CA_CERTS=$outFile (or add to .env) before pnpm / node."
}
finally {
  $tcp.Close()
}
