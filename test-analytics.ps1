$merchant = @{email='merchant@example.com'; password='test123'} | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/auth/login' -ContentType 'application/json' -Body $merchant
$token = $login.data.token
Write-Host "Token: $($token.Substring(0, 30))..."

$headers = @{ 'Authorization' = "Bearer $token" }
$analytics = Invoke-RestMethod -Method Get -Uri 'http://localhost:5000/api/merchant/analytics' -Headers $headers

Write-Host "Analytics Response:"
$analytics.data.analytics | ConvertTo-Json -Depth 10
