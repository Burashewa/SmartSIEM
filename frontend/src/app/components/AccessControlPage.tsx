import { useState } from 'react';
import { Shield, Eye, User, CheckCircle2, XCircle, Info, Lock, Key } from 'lucide-react';
import React from 'react';

interface Role {
  id: string;
  name: string;
  description: string;
  icon: typeof Shield;
  color: string;
  userCount: number;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  administrator: boolean;
  securityAnalyst: boolean;
  viewer: boolean;
  critical: boolean;
}

const roles: Role[] = [
  {
    id: 'administrator',
    name: 'Administrator',
    description: 'Full system access with all privileges. Can manage users, configure system settings, and perform all operations.',
    icon: Shield,
    color: '#ef4444',
    userCount: 3,
  },
  {
    id: 'security-analyst',
    name: 'Security Analyst',
    description: 'Monitoring and advisory capabilities. Can view alerts, manage detection rules, and respond to security incidents.',
    icon: User,
    color: '#f59e0b',
    userCount: 12,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to dashboards and reports. Cannot modify any configurations or perform administrative actions.',
    icon: Eye,
    color: '#3b82f6',
    userCount: 28,
  },
];

const permissions: Permission[] = [
  // Dashboard Access
  {
    id: 'dashboard-view',
    name: 'View Dashboard',
    description: 'Access main security dashboard and metrics',
    category: 'Dashboard Access',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },
  {
    id: 'dashboard-customize',
    name: 'Customize Dashboard',
    description: 'Modify dashboard layout and widgets',
    category: 'Dashboard Access',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'dashboard-export',
    name: 'Export Dashboard Data',
    description: 'Download dashboard data and reports',
    category: 'Dashboard Access',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },

  // Log Management
  {
    id: 'log-view',
    name: 'View Logs',
    description: 'Read access to security logs and events',
    category: 'Log Management',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },
  {
    id: 'log-search',
    name: 'Search & Filter Logs',
    description: 'Perform advanced log searches and filtering',
    category: 'Log Management',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },
  {
    id: 'log-export',
    name: 'Export Logs',
    description: 'Download log data for analysis',
    category: 'Log Management',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'log-delete',
    name: 'Delete Logs',
    description: 'Permanently remove log entries from system',
    category: 'Log Management',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },
  {
    id: 'log-retention',
    name: 'Configure Log Retention',
    description: 'Set log retention policies and storage rules',
    category: 'Log Management',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },

  // Alert Management
  {
    id: 'alert-view',
    name: 'View Alerts',
    description: 'Access security alerts and notifications',
    category: 'Alert Management',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },
  {
    id: 'alert-acknowledge',
    name: 'Acknowledge Alerts',
    description: 'Mark alerts as acknowledged or in progress',
    category: 'Alert Management',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'alert-resolve',
    name: 'Resolve Alerts',
    description: 'Close and resolve security alerts',
    category: 'Alert Management',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'alert-delete',
    name: 'Delete Alerts',
    description: 'Permanently remove alerts from system',
    category: 'Alert Management',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },

  // Detection Rules
  {
    id: 'rule-view',
    name: 'View Detection Rules',
    description: 'Read access to security detection rules',
    category: 'Detection Rules',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },
  {
    id: 'rule-enable-disable',
    name: 'Enable/Disable Rules',
    description: 'Toggle detection rules on or off',
    category: 'Detection Rules',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'rule-create',
    name: 'Create Rules',
    description: 'Define new detection rules',
    category: 'Detection Rules',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'rule-modify',
    name: 'Modify Rules',
    description: 'Edit existing detection rule configurations',
    category: 'Detection Rules',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'rule-delete',
    name: 'Delete Rules',
    description: 'Permanently remove detection rules',
    category: 'Detection Rules',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },

  // Threat Detection
  {
    id: 'threat-view',
    name: 'View Threats',
    description: 'Access threat detection data and analysis',
    category: 'Threat Detection',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },
  {
    id: 'threat-investigate',
    name: 'Investigate Threats',
    description: 'Perform deep-dive threat analysis',
    category: 'Threat Detection',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'threat-respond',
    name: 'Threat Response Actions',
    description: 'Execute incident response procedures',
    category: 'Threat Detection',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },

  // AI Recommendations
  {
    id: 'ai-view',
    name: 'View AI Recommendations',
    description: 'Access AI-powered security advisories',
    category: 'AI Recommendations',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },
  {
    id: 'ai-implement',
    name: 'Implement Recommendations',
    description: 'Apply AI-suggested security measures',
    category: 'AI Recommendations',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },

  // User Management
  {
    id: 'user-view',
    name: 'View Users',
    description: 'See list of system users and roles',
    category: 'User Management',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: false,
  },
  {
    id: 'user-create',
    name: 'Create Users',
    description: 'Add new users to the system',
    category: 'User Management',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },
  {
    id: 'user-modify',
    name: 'Modify Users',
    description: 'Edit user details and permissions',
    category: 'User Management',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },
  {
    id: 'user-delete',
    name: 'Delete Users',
    description: 'Remove users from the system',
    category: 'User Management',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },
  {
    id: 'role-assign',
    name: 'Assign Roles',
    description: 'Grant or revoke user roles and permissions',
    category: 'User Management',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },

  // System Configuration
  {
    id: 'system-view-config',
    name: 'View System Configuration',
    description: 'Read system settings and configurations',
    category: 'System Configuration',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: false,
  },
  {
    id: 'system-modify-config',
    name: 'Modify System Configuration',
    description: 'Change system settings and parameters',
    category: 'System Configuration',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },
  {
    id: 'system-backup',
    name: 'Backup & Restore',
    description: 'Create and restore system backups',
    category: 'System Configuration',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },
  {
    id: 'system-audit-log',
    name: 'Access Audit Logs',
    description: 'View system audit and access logs',
    category: 'System Configuration',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: false,
  },

  // API Access
  {
    id: 'api-read',
    name: 'API Read Access',
    description: 'Read data via REST API endpoints',
    category: 'API Access',
    administrator: true,
    securityAnalyst: true,
    viewer: true,
    critical: false,
  },
  {
    id: 'api-write',
    name: 'API Write Access',
    description: 'Create and modify data via API',
    category: 'API Access',
    administrator: true,
    securityAnalyst: true,
    viewer: false,
    critical: false,
  },
  {
    id: 'api-delete',
    name: 'API Delete Access',
    description: 'Delete data via API endpoints',
    category: 'API Access',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },
  {
    id: 'api-admin',
    name: 'API Administrative Access',
    description: 'Full API access including system operations',
    category: 'API Access',
    administrator: true,
    securityAnalyst: false,
    viewer: false,
    critical: true,
  },
];

export function AccessControlPage() {
  const [selectedRole, setSelectedRole] = useState<string>('administrator');
  const [viewMode, setViewMode] = useState<'matrix' | 'list'>('matrix');

  const categories = Array.from(new Set(permissions.map(p => p.category)));

  const getRoleColor = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    return role?.color || '#666';
  };

  const getPermissionCount = (roleId: string) => {
    return permissions.filter(p => p[roleId as keyof Permission] === true).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-white mb-2">Access Control</h1>
          <p className="text-gray-400">
            Role-Based Access Control (RBAC) configuration and permissions management
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5]/20 border border-[#4f46e5]/30 rounded">
          <Lock className="size-5 text-[#4f46e5]" />
          <span className="text-sm text-[#4f46e5] font-medium">Least Privilege Principle</span>
        </div>
      </div>

      {/* Role Cards */}
      <div>
        <h2 className="text-xl text-white mb-4 flex items-center gap-2">
          <Key className="size-5 text-[#4f46e5]" />
          System Roles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roles.map((role) => {
            const Icon = role.icon;
            const permissionCount = getPermissionCount(role.id);
            const permissionPercentage = Math.round((permissionCount / permissions.length) * 100);

            return (
              <div
                key={role.id}
                className={`bg-[#0f0f17] border rounded-lg p-6 transition-all cursor-pointer ${
                  selectedRole === role.id
                    ? 'border-[#4f46e5] shadow-lg shadow-[#4f46e5]/20'
                    : 'border-[#1f1f2e] hover:border-[#2a2a3a]'
                }`}
                onClick={() => setSelectedRole(role.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="p-3 rounded-lg"
                    style={{
                      backgroundColor: `${role.color}20`,
                      borderColor: `${role.color}30`,
                      borderWidth: '1px',
                    }}
                  >
                    <Icon className="size-6" style={{ color: role.color }} />
                  </div>
                  <span className="text-xs font-mono text-gray-400 bg-[#1a1a24] px-2 py-1 rounded">
                    {role.userCount} users
                  </span>
                </div>
                <h3 className="text-lg text-white font-medium mb-2">{role.name}</h3>
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                  {role.description}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Permissions</span>
                    <span className="text-white font-medium">
                      {permissionCount} / {permissions.length}
                    </span>
                  </div>
                  <div className="w-full bg-[#1a1a24] rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${permissionPercentage}%`,
                        backgroundColor: role.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[#4f46e5]/10 border border-[#4f46e5]/30 rounded-lg p-4 flex items-start gap-3">
        <Info className="size-5 text-[#4f46e5] flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-white font-medium mb-1">Least Privilege Principle</h4>
          <p className="text-sm text-gray-300">
            Access rights are granted based on job requirements. Users receive only the minimum permissions necessary to perform their duties, reducing the attack surface and limiting potential damage from compromised accounts.
          </p>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl text-white flex items-center gap-2">
          <Shield className="size-5 text-[#4f46e5]" />
          Permissions Matrix
        </h2>
        <div className="flex items-center gap-2 bg-[#1a1a24] border border-[#2a2a3a] rounded p-1">
          <button
            onClick={() => setViewMode('matrix')}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              viewMode === 'matrix'
                ? 'bg-[#4f46e5] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Matrix View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-[#4f46e5] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            List View
          </button>
        </div>
      </div>

      {/* Permissions Content */}
      {viewMode === 'matrix' ? (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1f1f2e] bg-[#0a0a0f]">
                  <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider sticky left-0 bg-[#0a0a0f] z-10">
                    Permission
                  </th>
                  <th className="text-center py-4 px-6 text-xs font-medium uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-1">
                      <Shield className="size-5" style={{ color: getRoleColor('administrator') }} />
                      <span style={{ color: getRoleColor('administrator') }}>Administrator</span>
                    </div>
                  </th>
                  <th className="text-center py-4 px-6 text-xs font-medium uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-1">
                      <User className="size-5" style={{ color: getRoleColor('security-analyst') }} />
                      <span style={{ color: getRoleColor('security-analyst') }}>Security Analyst</span>
                    </div>
                  </th>
                  <th className="text-center py-4 px-6 text-xs font-medium uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-1">
                      <Eye className="size-5" style={{ color: getRoleColor('viewer') }} />
                      <span style={{ color: getRoleColor('viewer') }}>Viewer</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <React.Fragment key={category}>
                    <tr className="border-b border-[#1f1f2e] bg-[#0a0a0f]">
                      <td colSpan={4} className="py-3 px-6">
                        <span className="text-sm font-medium text-white">{category}</span>
                      </td>
                    </tr>
                    {permissions
                      .filter((p) => p.category === category)
                      .map((permission) => (
                        <tr
                          key={permission.id}
                          className="border-b border-[#1f1f2e] hover:bg-[#1a1a24] transition-colors"
                        >
                          <td className="py-4 px-6 sticky left-0 bg-[#0f0f17] hover:bg-[#1a1a24]">
                            <div className="flex items-start gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white font-medium">
                                    {permission.name}
                                  </span>
                                  {permission.critical && (
                                    <span className="text-xs px-2 py-0.5 bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 rounded">
                                      CRITICAL
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {permission.administrator ? (
                              <CheckCircle2 className="size-5 text-[#10b981] mx-auto" />
                            ) : (
                              <XCircle className="size-5 text-gray-600 mx-auto" />
                            )}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {permission.securityAnalyst ? (
                              <CheckCircle2 className="size-5 text-[#10b981] mx-auto" />
                            ) : (
                              <XCircle className="size-5 text-gray-600 mx-auto" />
                            )}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {permission.viewer ? (
                              <CheckCircle2 className="size-5 text-[#10b981] mx-auto" />
                            ) : (
                              <XCircle className="size-5 text-gray-600 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category} className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg overflow-hidden">
              <div className="bg-[#0a0a0f] border-b border-[#1f1f2e] px-6 py-3">
                <h3 className="text-white font-medium">{category}</h3>
              </div>
              <div className="p-6 space-y-4">
                {permissions
                  .filter((p) => p.category === category)
                  .filter((p) => p[selectedRole as keyof Permission] === true)
                  .map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-start gap-3 p-4 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg"
                    >
                      <CheckCircle2 className="size-5 text-[#10b981] flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-white font-medium">
                            {permission.name}
                          </span>
                          {permission.critical && (
                            <span className="text-xs px-2 py-0.5 bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 rounded">
                              CRITICAL
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{permission.description}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}