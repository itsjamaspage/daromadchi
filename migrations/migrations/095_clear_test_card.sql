-- Clear the ATMOS sandbox test card (****8807, OYBEK SAFABOEV, 03/29) that was
-- bound during development testing. The seller can bind their real card through
-- the billing page's "Добавить способ оплаты" flow.
--
-- Additive + idempotent. Only touches the test card's display columns and token.

UPDATE subscriptions
SET card_id             = NULL,
    card_token_encrypted = NULL,
    card_last4           = NULL,
    card_expiry          = NULL,
    card_holder          = NULL
WHERE card_last4 = '8807'
  AND card_holder ILIKE '%SAFABOEV%';
