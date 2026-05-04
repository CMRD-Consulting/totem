<script setup lang="ts">
defineProps<{
  label: string;
  sublabel?: string;
  modelValue: boolean;
}>();

defineEmits<{ 'update:modelValue': [boolean] }>();
</script>

<template>
  <div
    @click="$emit('update:modelValue', !modelValue)"
    :style="{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 14px',
      borderRadius: '12px',
      background: 'var(--surface)',
      border: '0.5px solid var(--divider)',
      marginBottom: '6px',
      cursor: 'pointer',
    }"
  >
    <div style="flex: 1">
      <div
        :style="{
          fontFamily: 'Inter',
          fontWeight: 600,
          fontSize: '13.5px',
          color: 'var(--ink)',
        }"
      >{{ label }}</div>
      <div
        v-if="sublabel"
        :style="{
          fontFamily: 'Inter',
          fontSize: '11.5px',
          color: 'var(--muted)',
          marginTop: '2px',
          lineHeight: 1.35,
        }"
      >{{ sublabel }}</div>
    </div>
    <div
      :style="{
        width: '44px',
        height: '26px',
        borderRadius: '999px',
        background: modelValue ? 'var(--accent)' : 'var(--divider-strong)',
        position: 'relative',
        transition: 'background 0.18s',
        flexShrink: 0,
      }"
    >
      <div
        :style="{
          position: 'absolute',
          top: '2px',
          left: modelValue ? '20px' : '2px',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s cubic-bezier(.4,.2,.2,1)',
        }"
      />
    </div>
  </div>
</template>
