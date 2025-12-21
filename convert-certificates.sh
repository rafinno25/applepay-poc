#!/bin/bash

# Script to convert Apple Pay certificates
# Converts merchant_id.cer and apple_pay.cer to PEM format

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILES_DIR="${SCRIPT_DIR}/files"
CERTS_DIR="${SCRIPT_DIR}/certs"

echo "Converting Apple Pay certificates..."

# Check if files directory exists
if [ ! -d "$FILES_DIR" ]; then
    echo "Error: files directory not found!"
    exit 1
fi

# Create certs directory if it doesn't exist
mkdir -p "$CERTS_DIR"

# Convert merchant_id.cer to PEM format
if [ -f "$FILES_DIR/merchant_id.cer" ]; then
    echo "Converting merchant_id.cer to PEM format..."
    
    # Try DER format first
    if openssl x509 -inform DER -in "$FILES_DIR/merchant_id.cer" -out "$CERTS_DIR/apple-merchant-cert.pem" 2>/dev/null; then
        echo "✓ Successfully converted merchant_id.cer (DER format)"
    # Try PEM format if DER fails
    elif openssl x509 -in "$FILES_DIR/merchant_id.cer" -out "$CERTS_DIR/apple-merchant-cert.pem" 2>/dev/null; then
        echo "✓ Successfully converted merchant_id.cer (PEM format)"
    else
        echo "Error: Failed to convert merchant_id.cer"
        echo "Trying to check file format..."
        file "$FILES_DIR/merchant_id.cer"
        exit 1
    fi
    
    # Verify the certificate
    echo "Certificate details:"
    openssl x509 -in "$CERTS_DIR/apple-merchant-cert.pem" -noout -subject -dates 2>/dev/null || echo "Warning: Could not read certificate details"
else
    echo "Warning: merchant_id.cer not found in files directory"
fi

# Convert apple_pay.cer to PEM format (for reference, not used in code)
if [ -f "$FILES_DIR/apple_pay.cer" ]; then
    echo ""
    echo "Converting apple_pay.cer to PEM format (for reference)..."
    
    # Try DER format first
    if openssl x509 -inform DER -in "$FILES_DIR/apple_pay.cer" -out "$CERTS_DIR/apple-pay-cert.pem" 2>/dev/null; then
        echo "✓ Successfully converted apple_pay.cer (DER format)"
    # Try PEM format if DER fails
    elif openssl x509 -in "$FILES_DIR/apple_pay.cer" -out "$CERTS_DIR/apple-pay-cert.pem" 2>/dev/null; then
        echo "✓ Successfully converted apple_pay.cer (PEM format)"
    else
        echo "Error: Failed to convert apple_pay.cer"
        exit 1
    fi
    
    echo ""
    echo "⚠️  IMPORTANT: apple_pay.cer must be uploaded to Authorize.Net Merchant Interface"
    echo "   This file is NOT used in your code, only uploaded to Authorize.Net"
else
    echo "Warning: apple_pay.cer not found in files directory"
fi

echo ""
echo "=========================================="
echo "Certificate conversion complete!"
echo ""
echo "Files created in certs/ directory:"
ls -lh "$CERTS_DIR"/*.pem 2>/dev/null || echo "No PEM files found"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo ""
echo "1. You need the PRIVATE KEY for merchant_id.cer"
echo "   - Check if you have the .key or .p12 file"
echo "   - Or check Keychain Access (macOS) for the private key"
echo "   - Place it in: certs/apple-merchant-key.pem"
echo ""
echo "2. Upload apple_pay.cer to Authorize.Net:"
echo "   - Login to Authorize.Net Merchant Interface"
echo "   - Navigate: Account → Settings → Digital Payment Solutions → Apple Pay"
echo "   - Upload the apple_pay.cer file"
echo ""
echo "3. Update your .env file:"
echo "   APPLE_MERCHANT_CERT_PATH=./certs/apple-merchant-cert.pem"
echo "   APPLE_MERCHANT_KEY_PATH=./certs/apple-merchant-key.pem"
echo "=========================================="

