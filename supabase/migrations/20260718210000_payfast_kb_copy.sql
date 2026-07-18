-- Update support KB: PayFast is the public payment brand (replace Yoco marketing copy).
-- Also disable legacy QR-link checkout by default so PayFast is primary.

UPDATE public.kb_articles
SET
  slug = 'payfast-eft-payment',
  title = 'PayFast & EFT payment',
  summary = 'How to pay with PayFast or bank transfer and what happens next.',
  body_md = E'## Paying for membership\n\n1. Open **Pricing** or **Membership & receipts** and choose a plan (R45 / R55 / R65).\n2. **PayFast** — set up a card debit order on the secure PayFast page (choose your debit day). Access unlocks after confirmation.\n3. **EFT / bank transfer** — follow the on-screen bank details and reference. Keep your proof of payment.\n\nAdmin verifies EFT before premium is activated. PayFast unlocks automatically when ITN confirms. If payment is pending longer than expected, open Support chat with your reference.\n\nNever share card PINs or OTP codes with anyone claiming to be GLS support.',
  tags = array['payfast', 'eft', 'payment', 'billing'],
  updated_at = now()
WHERE slug IN ('yoco-eft-payment', 'payfast-eft-payment');

UPDATE public.manual_payment_settings
SET yoco_enabled = false
WHERE id = 'default' AND yoco_enabled = true;
