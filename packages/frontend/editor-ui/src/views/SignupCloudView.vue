<script lang="ts" setup>
import AuthView from '@/views/AuthView.vue';
import { useToast } from '@/composables/useToast';

import { computed, ref } from 'vue';
import type { IFormBoxConfig } from '@/Interface';
import { VIEWS } from '@/constants';
import { useUsersStore } from '@/stores/users.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useI18n } from '@n8n/i18n';
import { useRouter } from 'vue-router';

const usersStore = useUsersStore();
const settingsStore = useSettingsStore();

const toast = useToast();
const i18n = useI18n();
const router = useRouter();

const FORM_CONFIG: IFormBoxConfig = {
	title: 'Set up your cloud account',
	buttonText: 'Create account',
	inputs: [
		{
			name: 'firstName',
			properties: {
				label: i18n.baseText('auth.firstName'),
				maxlength: 32,
				required: true,
				autocomplete: 'given-name',
				capitalize: true,
				focusInitially: true,
			},
		},
		{
			name: 'lastName',
			properties: {
				label: i18n.baseText('auth.lastName'),
				maxlength: 32,
				required: true,
				autocomplete: 'family-name',
				capitalize: true,
			},
		},
		{
			name: 'email',
			properties: {
				label: i18n.baseText('auth.email'),
				type: 'email',
				required: true,
				autocomplete: 'email',
			},
		},
		{
			name: 'password',
			properties: {
				label: i18n.baseText('auth.password'),
				type: 'password',
				validationRules: [{ name: 'DEFAULT_PASSWORD_RULES' }],
				required: true,
				infoText: i18n.baseText('auth.defaultPasswordRequirements'),
				autocomplete: 'new-password',
				capitalize: true,
			},
		},
		{
			name: 'agree',
			properties: {
				label: i18n.baseText('auth.agreement.label'),
				type: 'checkbox',
			},
		},
	],
};

const loading = ref(false);

const subtitle = computed(() => {
	return 'Create your cloud account to get started with n8n';
});

async function onSubmit(values: { [key: string]: string | boolean }) {
	try {
		loading.value = true;
		await usersStore.signupCloud({
			firstName: values.firstName as string,
			lastName: values.lastName as string,
			email: values.email as string,
			password: values.password as string,
			agree: values.agree as boolean,
		});

		if (values.agree === true) {
			try {
				await usersStore.submitContactEmail(values.email.toString(), values.agree);
			} catch {}
		}

		// Send confirmation email after successful signup
		try {
			await usersStore.sendConfirmationEmail();
			toast.showMessage({
				title: 'Account created successfully!',
				message: 'Please check your email for a confirmation link to activate your account.',
				type: 'success',
			});
		} catch (error) {
			// Don't fail the signup if confirmation email fails
			console.warn('Failed to send confirmation email:', error);
		}

		await router.push({ name: VIEWS.HOMEPAGE });
	} catch (error) {
		toast.showError(error, 'Failed to create cloud account');
	}
	loading.value = false;
}

// Redirect to regular signup if not in cloud deployment
if (!settingsStore.isCloudDeployment) {
	void router.replace({ name: VIEWS.SIGNUP });
}
</script>

<template>
	<AuthView :form="FORM_CONFIG" :form-loading="loading" :subtitle="subtitle" @submit="onSubmit" />
</template>
