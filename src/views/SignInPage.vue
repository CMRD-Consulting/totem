<script setup lang="ts">
import { IonPage } from '@ionic/vue';
import { Capacitor } from '@capacitor/core';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Wordmark from '@/components/Wordmark.vue';
import LogoMark from '@/components/LogoMark.vue';
import { supabase } from '@/lib/supabase';

const router = useRouter();
const route = useRoute();
const busy = ref(false);
const error = ref<string | null>(null);

// Email-OTP fallback state
type Step = 'idle' | 'sent';
const step = ref<Step>('idle');
const email = ref('');
const otp = ref('');

const otpReady = computed(() => /^\d{6}$/.test(otp.value.trim()));
const emailReady = computed(() =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()),
);

async function signInApple() {
  busy.value = true;
  error.value = null;
  try {
    if (Capacitor.isNativePlatform()) {
      const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
      const result = await SignInWithApple.authorize({
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID ?? 'dev.cmrd.totem.signin',
        redirectURI: `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/callback`,
        scopes: 'email name',
      });
      const idToken = result.response.identityToken;
      if (!idToken) throw new Error('No identity token returned');
      const { error: authErr } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
      });
      if (authErr) throw authErr;
    } else {
      const redirectTo = `${window.location.origin}${(route.query.redirect as string) || '/'}`;
      const { error: authErr } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo },
      });
      if (authErr) throw authErr;
      return;
    }
    router.replace((route.query.redirect as string) || '/');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function sendCode() {
  if (!emailReady.value || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.value.trim(),
      options: { shouldCreateUser: true },
    });
    if (err) throw err;
    step.value = 'sent';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function verifyCode() {
  if (!otpReady.value || busy.value) return;
  busy.value = true;
  error.value = null;
  try {
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.value.trim(),
      token: otp.value.trim(),
      type: 'email',
    });
    if (err) throw err;
    router.replace((route.query.redirect as string) || '/');
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

function resetEmail() {
  step.value = 'idle';
  otp.value = '';
  error.value = null;
}
</script>

<template>
  <ion-page>
    <div
      style="
        width: 100%;
        height: 100%;
        background: var(--bg);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0 32px;
        box-sizing: border-box;
        overflow: auto;
      "
    >
      <div style="text-align: center; max-width: 320px">
        <div :style="{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }">
          <LogoMark :size="100" />
          <Wordmark :size="64" />
        </div>
        <div
          :style="{
            fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
            fontStyle: 'italic',
            fontSize: '20px',
            color: 'var(--muted)',
            marginTop: '20px',
            lineHeight: 1.35,
          }"
        >
          a private group chat <br />
          made of songs.
        </div>
      </div>

      <div style="width: 100%; max-width: 320px; margin-top: 36px">
        <!-- Apple sign-in -->
        <button
          @click="signInApple"
          :disabled="busy"
          :style="{
            all: 'unset',
            cursor: busy ? 'wait' : 'pointer',
            boxSizing: 'border-box',
            width: '100%',
            height: '52px',
            borderRadius: '14px',
            background: 'var(--ink)',
            color: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontFamily: 'Inter',
            fontWeight: 600,
            fontSize: '15px',
            opacity: busy ? 0.6 : 1,
            transition: 'opacity 0.18s',
          }"
        >
          <svg width="18" height="18" viewBox="0 0 814 1000" style="display: block">
            <path
              d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
              fill="var(--surface)"
            />
          </svg>
          <span>Sign in with Apple</span>
        </button>

        <!-- Divider -->
        <div
          :style="{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '20px 0',
            fontFamily: '&quot;Instrument Serif&quot;, Georgia, serif',
            fontStyle: 'italic',
            fontSize: '13px',
            color: 'var(--muted-2)',
          }"
        >
          <div style="flex: 1; height: 0.5px; background: var(--divider)"></div>
          <span>or</span>
          <div style="flex: 1; height: 0.5px; background: var(--divider)"></div>
        </div>

        <!-- Email + OTP -->
        <template v-if="step === 'idle'">
          <input
            v-model="email"
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="off"
            spellcheck="false"
            placeholder="you@example.com"
            :disabled="busy"
            @keyup.enter="sendCode"
            :style="{
              all: 'unset',
              boxSizing: 'border-box',
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              background: 'var(--surface)',
              border: '0.5px solid var(--divider)',
              fontFamily: 'Inter',
              fontSize: '15px',
              color: 'var(--ink)',
            }"
          />
          <button
            @click="sendCode"
            :disabled="!emailReady || busy"
            :style="{
              all: 'unset',
              cursor: !emailReady || busy ? 'not-allowed' : 'pointer',
              boxSizing: 'border-box',
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              background: emailReady ? 'var(--accent)' : 'var(--chip-strong)',
              color: emailReady ? '#fff' : 'var(--muted-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: '14px',
              marginTop: '10px',
              transition: 'background 0.18s',
            }"
          >{{ busy ? 'sending…' : 'email me a code' }}</button>
        </template>

        <template v-else>
          <div
            :style="{
              fontFamily: 'Inter',
              fontSize: '13px',
              color: 'var(--muted)',
              textAlign: 'center',
              marginBottom: '12px',
              lineHeight: 1.4,
            }"
          >
            we sent a 6-digit code to<br />
            <span style="color: var(--ink); font-weight: 600">{{ email }}</span>
          </div>
          <input
            v-model="otp"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="123456"
            :disabled="busy"
            @keyup.enter="verifyCode"
            :style="{
              all: 'unset',
              boxSizing: 'border-box',
              width: '100%',
              padding: '14px 16px',
              borderRadius: '14px',
              background: 'var(--surface)',
              border: '0.5px solid var(--divider)',
              fontFamily: '&quot;JetBrains Mono&quot;, ui-monospace, monospace',
              fontSize: '20px',
              letterSpacing: '0.4em',
              textAlign: 'center',
              color: 'var(--ink)',
            }"
          />
          <button
            @click="verifyCode"
            :disabled="!otpReady || busy"
            :style="{
              all: 'unset',
              cursor: !otpReady || busy ? 'not-allowed' : 'pointer',
              boxSizing: 'border-box',
              width: '100%',
              height: '48px',
              borderRadius: '14px',
              background: otpReady ? 'var(--accent)' : 'var(--chip-strong)',
              color: otpReady ? '#fff' : 'var(--muted-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Inter',
              fontWeight: 600,
              fontSize: '14px',
              marginTop: '10px',
              transition: 'background 0.18s',
            }"
          >{{ busy ? 'verifying…' : 'verify' }}</button>
          <button
            @click="resetEmail"
            :style="{
              all: 'unset',
              cursor: 'pointer',
              display: 'block',
              width: '100%',
              textAlign: 'center',
              marginTop: '12px',
              fontFamily: 'Inter',
              fontSize: '12px',
              color: 'var(--muted)',
            }"
          >use a different email</button>
        </template>

        <!-- Error pill -->
        <div
          v-if="error"
          :style="{
            marginTop: '14px',
            padding: '10px 12px',
            borderRadius: '10px',
            background: 'var(--accent-soft)',
            border: '1px solid var(--accent)',
            fontFamily: 'Inter',
            fontSize: '12px',
            color: 'var(--accent)',
            textAlign: 'center',
          }"
        >{{ error }}</div>

        <div
          :style="{
            marginTop: '24px',
            fontFamily: 'Inter',
            fontSize: '11px',
            color: 'var(--muted-2)',
            textAlign: 'center',
            lineHeight: 1.5,
          }"
        >
          we don't ask for contacts or browse what you listen to.
        </div>
      </div>
    </div>
  </ion-page>
</template>
