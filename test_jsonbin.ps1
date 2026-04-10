# 测试 JSONBin API
$headers = @{
    "Content-Type" = "application/json"
    "X-Access-Key" = "$2a$10$RVSQqvdx8S1r1SadSudgjeAuUCrnqN1ugUNRA6JMJ5TYB4VuYa1h2"
    "X-Bin-Name" = "quiz_test_$([DateTimeOffset]::Now.ToUnixTimeSeconds())"
}
$body = '{"test": true}'

try {
    $response = Invoke-RestMethod -Uri "https://api.jsonbin.io/v3/b" -Method Post -Headers $headers -Body $body
    Write-Host "SUCCESS: $($response | ConvertTo-Json -Depth 3)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
