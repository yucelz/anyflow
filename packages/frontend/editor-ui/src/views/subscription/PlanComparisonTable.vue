<template>
	<div class="plan-comparison-table">
		<div class="table-container">
			<table>
				<thead>
					<tr>
						<th class="feature-column">Features</th>
						<th v-for="plan in plans" :key="plan.id" class="plan-column">
							{{ plan.name }}
						</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td class="feature-name">Monthly Price</td>
						<td v-for="plan in plans" :key="`${plan.id}-monthly`">${{ plan.monthlyPrice }}</td>
					</tr>
					<tr>
						<td class="feature-name">Yearly Price (per month)</td>
						<td v-for="plan in plans" :key="`${plan.id}-yearly`">
							${{ Math.floor(plan.yearlyPrice / 12) }}
						</td>
					</tr>
					<tr>
						<td class="feature-name">Monthly Executions</td>
						<td v-for="plan in plans" :key="`${plan.id}-executions`">
							<span v-if="plan.monthlyExecutionsLimit === -1"> Unlimited </span>
							<span v-else>
								{{ formatNumber(plan.monthlyExecutionsLimit) }}
							</span>
						</td>
					</tr>
					<tr>
						<td class="feature-name">Active Workflows</td>
						<td v-for="plan in plans" :key="`${plan.id}-workflows`">
							{{ plan.activeWorkflowsLimit }}
						</td>
					</tr>
					<tr>
						<td class="feature-name">Credentials</td>
						<td v-for="plan in plans" :key="`${plan.id}-credentials`">
							{{ plan.credentialsLimit }}
						</td>
					</tr>
					<tr>
						<td class="feature-name">Team Members</td>
						<td v-for="plan in plans" :key="`${plan.id}-users`">
							{{ plan.usersLimit }}
						</td>
					</tr>
					<tr>
						<td class="feature-name">Trial Period</td>
						<td v-for="plan in plans" :key="`${plan.id}-trial`">
							<span v-if="plan.trialDays > 0"> {{ plan.trialDays }} days </span>
							<span v-else>-</span>
						</td>
					</tr>
					<tr>
						<td class="feature-name">Advanced Nodes</td>
						<td v-for="plan in plans" :key="`${plan.id}-advanced`">
							<span :class="plan.features?.advancedNodes ? 'feature-yes' : 'feature-no'">
								{{ plan.features?.advancedNodes ? '✓' : '✗' }}
							</span>
						</td>
					</tr>
					<tr>
						<td class="feature-name">Priority Support</td>
						<td v-for="plan in plans" :key="`${plan.id}-support`">
							<span :class="plan.features?.prioritySupport ? 'feature-yes' : 'feature-no'">
								{{ plan.features?.prioritySupport ? '✓' : '✗' }}
							</span>
						</td>
					</tr>
					<tr>
						<td class="feature-name">Single Sign-On (SSO)</td>
						<td v-for="plan in plans" :key="`${plan.id}-sso`">
							<span :class="plan.features?.sso ? 'feature-yes' : 'feature-no'">
								{{ plan.features?.sso ? '✓' : '✗' }}
							</span>
						</td>
					</tr>
					<tr>
						<td class="feature-name">Audit Logs</td>
						<td v-for="plan in plans" :key="`${plan.id}-audit`">
							<span :class="plan.features?.auditLogs ? 'feature-yes' : 'feature-no'">
								{{ plan.features?.auditLogs ? '✓' : '✗' }}
							</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script lang="ts" setup>
import type { SubscriptionPlan } from '@/types/subscription';

interface Props {
	plans: SubscriptionPlan[];
}

withDefaults(defineProps<Props>(), {
	plans: () => [],
});

const formatNumber = (num: number) => {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1) + 'M';
	} else if (num >= 1000) {
		return (num / 1000).toFixed(0) + 'K';
	}
	return num.toString();
};
</script>

<style lang="scss" scoped>
.plan-comparison-table {
	.table-container {
		overflow-x: auto;
		border: 1px solid var(--color-foreground-base);
		border-radius: 8px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		background: var(--color-background-base);

		th,
		td {
			padding: 1rem;
			text-align: center;
			border-bottom: 1px solid var(--color-foreground-light);

			&:not(:last-child) {
				border-right: 1px solid var(--color-foreground-light);
			}
		}

		thead {
			background: var(--color-background-light);

			th {
				font-weight: 600;
				color: var(--color-text-dark);
			}

			.feature-column {
				text-align: left;
				min-width: 200px;
			}

			.plan-column {
				min-width: 120px;
			}
		}

		tbody {
			tr:hover {
				background: var(--color-background-light);
			}

			.feature-name {
				text-align: left;
				font-weight: 500;
				color: var(--color-text-dark);
			}

			.feature-yes {
				color: var(--color-success);
			}

			.feature-no {
				color: var(--color-danger-tint-1);
			}
		}
	}

	@media (max-width: 768px) {
		.table-container {
			border-radius: 0;
			border-left: none;
			border-right: none;
		}

		table {
			font-size: 0.875rem;

			th,
			td {
				padding: 0.75rem 0.5rem;
			}

			.feature-column {
				min-width: 150px;
			}

			.plan-column {
				min-width: 100px;
			}
		}
	}
}
</style>
