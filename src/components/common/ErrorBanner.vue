<template>
  <Transition name="slide-down">
    <div v-if="visible" class="error-banner" :class="bannerClass" role="alert">
      <div class="error-icon">
        <AlertCircle v-if="severity === 'error'" :size="20" />
        <AlertTriangle v-else-if="severity === 'warning'" :size="20" />
        <Info v-else :size="20" />
      </div>
      <div class="error-content">
        <p class="error-title">{{ title }}</p>
        <p v-if="message" class="error-message">{{ message }}</p>
        <p v-if="suggestion" class="error-suggestion">{{ suggestion }}</p>
      </div>
      <div class="error-actions" v-if="dismissible">
        <button class="btn-dismiss" @click="dismiss" title="Dismiss">
          <X :size="16" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

const props = defineProps({
  visible: {
    type: Boolean,
    default: true
  },
  severity: {
    type: String,
    default: 'error',
    validator: (v) => ['error', 'warning', 'info'].includes(v)
  },
  title: {
    type: String,
    default: 'Something went wrong'
  },
  message: {
    type: String,
    default: ''
  },
  suggestion: {
    type: String,
    default: ''
  },
  dismissible: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['dismiss'])

const bannerClass = computed(() => `error-banner--${props.severity}`)

const dismiss = () => {
  emit('dismiss')
}
</script>

<style scoped>
.error-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  margin: var(--spacing-md) 0;
  animation: slideDown var(--duration-normal) var(--easing-standard);
}

.error-banner--error {
  background: var(--color-error-opacity-10);
  border: 1px solid var(--color-error);
  color: var(--color-error);
}

.error-banner--warning {
  background: var(--color-warning-opacity-10);
  border: 1px solid var(--color-warning);
  color: var(--color-warning);
}

.error-banner--info {
  background: var(--accent-blue-opacity-10);
  border: 1px solid var(--accent-blue);
  color: var(--accent-blue);
}

.error-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.error-content {
  flex: 1;
  min-width: 0;
}

.error-title {
  font-weight: 600;
  font-size: var(--font-size-sm);
  margin: 0 0 var(--spacing-xs);
  color: var(--text-primary);
}

.error-banner--error .error-title {
  color: var(--color-error);
}

.error-banner--warning .error-title {
  color: var(--color-warning);
}

.error-banner--info .error-title {
  color: var(--accent-blue);
}

.error-message {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-xs);
  line-height: 1.5;
}

.error-suggestion {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin: 0;
  font-style: italic;
}

.error-actions {
  flex-shrink: 0;
}

.btn-dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-dismiss:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.slide-down-enter-active {
  animation: slideDown var(--duration-normal) var(--easing-standard);
}

.slide-down-leave-active {
  animation: slideUp var(--duration-fast) var(--easing-standard);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}
</style>