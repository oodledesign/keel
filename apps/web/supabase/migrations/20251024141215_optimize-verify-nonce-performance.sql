-- Add optimized index for verify_nonce function query pattern
-- Matches filter order: purpose → expires_at → user_id
CREATE INDEX IF NOT EXISTS idx_nonces_verify_lookup ON public.nonces (purpose, expires_at DESC, user_id)
  WHERE used_at IS NULL AND revoked = FALSE;

-- Optimize verify_nonce function for performance

-- New implementation:
-- 1. Adds optimized index for the verify query pattern
-- 2. Uses CTE to filter candidates using index first
-- 3. Only does bcrypt comparison on filtered candidates
-- 4. Updates only the matched token in a single operation
create or replace function public.verify_nonce (
    p_token TEXT,
    p_purpose TEXT,
    p_user_id UUID default null,
    p_required_scopes text[] default null,
    p_max_verification_attempts INTEGER default 5,
    p_ip INET default null,
    p_user_agent TEXT default null
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
    set
        SEARCH_PATH to '' as $$
DECLARE
    v_nonce          RECORD;
BEGIN
    -- Find and update the nonce in a single operation
    -- First filter by indexed columns to reduce candidate rows, then do bcrypt comparison
    WITH candidate_nonces AS (
        -- Use index to filter candidates by purpose, user_id, expiry, status
        SELECT id, client_token, user_id, purpose, metadata, scopes,
               verification_attempts, expires_at, used_at, revoked
        FROM public.nonces
        WHERE purpose = p_purpose
          AND used_at IS NULL
          AND NOT revoked
          AND expires_at > NOW()
          -- Only apply user_id filter if the token was created for a specific user
          AND (
            -- Case 1: Anonymous token (user_id is NULL in DB)
            (user_id IS NULL)
                OR
                -- Case 2: User-specific token (check if user_id matches)
            (user_id = p_user_id)
          )
        ORDER BY created_at DESC
        -- Safety net: Limit to 100 most recent candidates to cap worst-case performance
        -- In production, auto-revocation keeps this low, but this protects against edge cases
        LIMIT 100
        -- CRITICAL: Lock rows to prevent race conditions in concurrent verifications
        -- SKIP LOCKED ensures other requests fail fast instead of waiting
        FOR UPDATE SKIP LOCKED
    ),
    matched_nonce AS (
        -- Now do the expensive bcrypt comparison only on filtered candidates
        SELECT *
        FROM candidate_nonces
        WHERE client_token = extensions.crypt(p_token, client_token)
        LIMIT 1
    ),
    updated_nonce AS (
        -- Update only the matched nonce
        UPDATE public.nonces
        SET verification_attempts        = verification_attempts + 1,
            last_verification_at         = NOW(),
            last_verification_ip         = COALESCE(p_ip, last_verification_ip),
            last_verification_user_agent = COALESCE(p_user_agent, last_verification_user_agent)
        WHERE id = (SELECT id FROM matched_nonce)
        RETURNING *
    )
    SELECT * INTO v_nonce FROM updated_nonce;

    -- Check if nonce exists
    IF v_nonce.id IS NULL THEN
        RETURN jsonb_build_object(
                'valid', false,
                'message', 'Invalid or expired token'
               );
    END IF;

    -- Check if max verification attempts exceeded (using the incremented value)
    IF p_max_verification_attempts > 0 AND v_nonce.verification_attempts > p_max_verification_attempts THEN
        -- Automatically revoke the token
        UPDATE public.nonces
        SET revoked        = TRUE,
            revoked_reason = 'Maximum verification attempts exceeded'
        WHERE id = v_nonce.id;

        RETURN jsonb_build_object(
                'valid', false,
                'message', 'Token revoked due to too many verification attempts',
                'max_attempts_exceeded', true
               );
    END IF;

    -- Check scopes if required
    IF p_required_scopes IS NOT NULL AND array_length(p_required_scopes, 1) > 0 THEN
        -- Fix scope validation to properly check if token scopes contain all required scopes
        -- Using array containment check: array1 @> array2 (array1 contains array2)
        IF NOT (v_nonce.scopes @> p_required_scopes) THEN
            RETURN jsonb_build_object(
                    'valid', false,
                    'message', 'Token does not have required permissions',
                    'token_scopes', v_nonce.scopes,
                    'required_scopes', p_required_scopes
                   );
        END IF;
    END IF;

    -- Mark nonce as used
    UPDATE public.nonces
    SET used_at = NOW()
    WHERE id = v_nonce.id;

    -- Return success with metadata
    RETURN jsonb_build_object(
            'valid', true,
            'user_id', v_nonce.user_id,
            'metadata', v_nonce.metadata,
            'scopes', v_nonce.scopes,
            'purpose', v_nonce.purpose
           );
END;
$$;
