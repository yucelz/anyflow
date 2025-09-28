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

const userEmail = ref('');
const isEmailVerified = ref(false);
const showVerification = ref(false);

async function sendVerificationCode(email: string) {
	try {
		// Save email for later use
		userEmail.value = email;
		// This should make API call to send verification email
		await usersStore.sendVerificationEmail(email);
		showVerification.value = true;
		toast.showMessage({
			title: 'Verification Code Sent',
			message: 'Please check your email for the verification code',
			type: 'info',
		});
	} catch (error) {
		toast.showError(error, 'Failed to send verification code');
	}
}

async function verifyCode(code: string) {
	try {
		// This should make API call to verify the code
		await usersStore.verifyEmailCode(userEmail.value, code);
		isEmailVerified.value = true;
		toast.showMessage({
			title: 'Email Verified',
			message: 'You can now create your account',
			type: 'success',
		});
	} catch (error) {
		toast.showError(error, 'Invalid verification code');
	}
}

const buttonText = computed(() => {
	if (!showVerification.value) return 'Send Verification Code';
	if (!isEmailVerified.value) return 'Verify Code';
	return 'Create Account';
});

const FORM_CONFIG = computed(
	(): IFormBoxConfig => ({
		title: 'Set up your cloud account',
		buttonText: buttonText.value,
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
			...(showVerification.value
				? [
						{
							name: 'verificationCode',
							properties: {
								label: 'Verification Code',
								type: 'password' as const,
								required: true,
								maxlength: 6,
								placeholder: 'Enter 6-digit code',
								validationRules: [
									{
										name: 'REGEX',
										config: {
											regex: '^[0-9]{6}$',
											message: 'Please enter a valid 6-digit code',
										},
									},
								],
							},
						},
					]
				: []),
		],
	}),
);

const loading = ref(false);

const subtitle = computed(() => {
	return 'Create your cloud account to get started with n8n';
});

async function onSubmit(values: { [key: string]: string | boolean }) {
	try {
		// If verification code hasn't been sent yet, send it
		if (!showVerification.value) {
			await sendVerificationCode(values.email as string);
			return;
		}

		// If verification code was sent but not verified yet, verify it
		if (!isEmailVerified.value) {
			await verifyCode(values.verificationCode as string);
			return;
		}

		// If email is verified, proceed with signup
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
