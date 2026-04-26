import { useState } from 'react';
import { Users, Plus, Edit2, Trash2, Shield, User, Eye, Search, AlertTriangle, CheckCircle2, X, Lock, Mail, UserCircle2, Calendar } from 'lucide-react';

interface UserAccount {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'administrator' | 'security-analyst' | 'viewer';
  status: 'active' | 'disabled' | 'locked';
  createdDate: string;
  lastLogin: string;
  loginCount: number;
}

interface NewUserForm {
  username: string;
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  role: 'administrator' | 'security-analyst' | 'viewer';
}

const mockUsers: UserAccount[] = [
  {
    id: 'USR-001',
    username: 'admin',
    email: 'admin@company.com',
    fullName: 'System Administrator',
    role: 'administrator',
    status: 'active',
    createdDate: '2025-01-15T10:00:00Z',
    lastLogin: '2026-03-04T14:20:00Z',
    loginCount: 342,
  },
  {
    id: 'USR-002',
    username: 'sarah.mitchell',
    email: 'sarah.mitchell@company.com',
    fullName: 'Sarah Mitchell',
    role: 'administrator',
    status: 'active',
    createdDate: '2025-02-01T09:30:00Z',
    lastLogin: '2026-03-04T13:45:00Z',
    loginCount: 256,
  },
  {
    id: 'USR-003',
    username: 'john.walker',
    email: 'john.walker@company.com',
    fullName: 'John Walker',
    role: 'security-analyst',
    status: 'active',
    createdDate: '2025-02-10T14:15:00Z',
    lastLogin: '2026-03-04T14:10:00Z',
    loginCount: 189,
  },
  {
    id: 'USR-004',
    username: 'emily.chen',
    email: 'emily.chen@company.com',
    fullName: 'Emily Chen',
    role: 'security-analyst',
    status: 'active',
    createdDate: '2025-02-15T11:00:00Z',
    lastLogin: '2026-03-04T12:30:00Z',
    loginCount: 167,
  },
  {
    id: 'USR-005',
    username: 'michael.jones',
    email: 'michael.jones@company.com',
    fullName: 'Michael Jones',
    role: 'security-analyst',
    status: 'active',
    createdDate: '2025-03-01T10:30:00Z',
    lastLogin: '2026-03-04T11:15:00Z',
    loginCount: 134,
  },
  {
    id: 'USR-006',
    username: 'lisa.brown',
    email: 'lisa.brown@company.com',
    fullName: 'Lisa Brown',
    role: 'viewer',
    status: 'active',
    createdDate: '2025-03-10T15:20:00Z',
    lastLogin: '2026-03-04T09:45:00Z',
    loginCount: 98,
  },
  {
    id: 'USR-007',
    username: 'david.kim',
    email: 'david.kim@company.com',
    fullName: 'David Kim',
    role: 'viewer',
    status: 'active',
    createdDate: '2025-03-15T13:45:00Z',
    lastLogin: '2026-03-03T16:20:00Z',
    loginCount: 76,
  },
  {
    id: 'USR-008',
    username: 'alex.rodriguez',
    email: 'alex.rodriguez@company.com',
    fullName: 'Alex Rodriguez',
    role: 'security-analyst',
    status: 'disabled',
    createdDate: '2025-02-20T09:00:00Z',
    lastLogin: '2026-02-28T14:30:00Z',
    loginCount: 45,
  },
  {
    id: 'USR-009',
    username: 'jessica.taylor',
    email: 'jessica.taylor@company.com',
    fullName: 'Jessica Taylor',
    role: 'viewer',
    status: 'locked',
    createdDate: '2025-03-20T11:30:00Z',
    lastLogin: '2026-03-02T10:15:00Z',
    loginCount: 23,
  },
];

export function UserManagementPage() {
  const [users, setUsers] = useState<UserAccount[]>(mockUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    username: '',
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    role: 'viewer',
  });
  const [passwordStrength, setPasswordStrength] = useState(0);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
      case 'security-analyst':
        return 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30';
      case 'viewer':
        return 'bg-[#3b82f6]/20 text-[#3b82f6] border-[#3b82f6]/30';
      default:
        return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'administrator':
        return <Shield className="size-4" />;
      case 'security-analyst':
        return <User className="size-4" />;
      case 'viewer':
        return <Eye className="size-4" />;
      default:
        return <User className="size-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30';
      case 'disabled':
        return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
      case 'locked':
        return 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30';
      default:
        return 'bg-gray-700/20 text-gray-400 border-gray-700/30';
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'administrator':
        return 'Administrator';
      case 'security-analyst':
        return 'Security Analyst';
      case 'viewer':
        return 'Viewer';
      default:
        return role;
    }
  };

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    return strength;
  };

  const handlePasswordChange = (password: string) => {
    setNewUserForm({ ...newUserForm, password });
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const getPasswordStrengthLabel = () => {
    if (passwordStrength <= 1) return { label: 'Weak', color: 'text-[#ef4444]' };
    if (passwordStrength <= 3) return { label: 'Medium', color: 'text-[#f59e0b]' };
    return { label: 'Strong', color: 'text-[#10b981]' };
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAddUser = () => {
    if (newUserForm.password !== newUserForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (passwordStrength < 3) {
      alert('Password is too weak. Please use a stronger password.');
      return;
    }

    const newUser: UserAccount = {
      id: `USR-${String(users.length + 1).padStart(3, '0')}`,
      username: newUserForm.username,
      email: newUserForm.email,
      fullName: newUserForm.fullName,
      role: newUserForm.role,
      status: 'active',
      createdDate: new Date().toISOString(),
      lastLogin: 'Never',
      loginCount: 0,
    };

    setUsers([...users, newUser]);
    setShowAddUserModal(false);
    setNewUserForm({
      username: '',
      email: '',
      fullName: '',
      password: '',
      confirmPassword: '',
      role: 'viewer',
    });
    setPasswordStrength(0);
  };

  const handleEditUser = (user: UserAccount) => {
    setSelectedUser(user);
    setShowEditUserModal(true);
  };

  const handleDeleteUser = (user: UserAccount) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = () => {
    if (selectedUser) {
      setUsers(users.filter((u) => u.id !== selectedUser.id));
      setShowDeleteConfirm(false);
      setSelectedUser(null);
    }
  };

  const toggleUserStatus = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? { ...user, status: user.status === 'active' ? 'disabled' : 'active' }
          : user
      )
    );
  };

  const updateUserRole = (role: 'administrator' | 'security-analyst' | 'viewer') => {
    if (selectedUser) {
      setUsers(
        users.map((user) =>
          user.id === selectedUser.id ? { ...user, role } : user
        )
      );
      setSelectedUser({ ...selectedUser, role });
    }
  };

  const activeCount = users.filter((u) => u.status === 'active').length;
  const disabledCount = users.filter((u) => u.status === 'disabled').length;
  const lockedCount = users.filter((u) => u.status === 'locked').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl text-white mb-2">User Management</h1>
          <p className="text-gray-400">
            Manage user accounts, roles, and access permissions
          </p>
        </div>
        <button
          onClick={() => setShowAddUserModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors font-medium"
        >
          <Plus className="size-5" />
          Add User
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="size-5 text-[#4f46e5]" />
            <span className="text-sm text-gray-400">Total Users</span>
          </div>
          <p className="text-2xl text-white font-bold">{users.length}</p>
        </div>
        <div className="bg-[#0f0f17] border border-[#10b981]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-5 text-[#10b981]" />
            <span className="text-sm text-gray-400">Active</span>
          </div>
          <p className="text-2xl text-[#10b981] font-bold">{activeCount}</p>
        </div>
        <div className="bg-[#0f0f17] border border-gray-700/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="size-5 text-gray-400" />
            <span className="text-sm text-gray-400">Disabled</span>
          </div>
          <p className="text-2xl text-gray-400 font-bold">{disabledCount}</p>
        </div>
        <div className="bg-[#0f0f17] border border-[#ef4444]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="size-5 text-[#ef4444]" />
            <span className="text-sm text-gray-400">Locked</span>
          </div>
          <p className="text-2xl text-[#ef4444] font-bold">{lockedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by user ID, username, email, or full name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a24] border border-[#2a2a3a] pl-12 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Filter by Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            >
              <option value="all">All Roles</option>
              <option value="administrator">Administrator</option>
              <option value="security-analyst">Security Analyst</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f1f2e] bg-[#0a0a0f]">
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  User ID
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Username
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Full Name
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Assigned Role
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Account Status
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="text-left py-4 px-6 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[#1f1f2e] hover:bg-[#1a1a24] transition-colors"
                >
                  <td className="py-4 px-6 text-sm text-gray-300 font-mono">
                    {user.id}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="size-5 text-gray-400" />
                      <span className="text-sm text-white font-medium">{user.username}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-300">
                    {user.fullName}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-400">
                    {user.email}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border rounded ${getRoleColor(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {getRoleName(user.role)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`text-xs px-2.5 py-1 border rounded ${getStatusColor(user.status)}`}>
                      {user.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-400 font-mono">
                    {user.lastLogin === 'Never' ? 'Never' : new Date(user.lastLogin).toLocaleString()}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors"
                        title="Edit User"
                      >
                        <Edit2 className="size-4" />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors"
                        title={user.status === 'active' ? 'Disable User' : 'Enable User'}
                      >
                        {user.status === 'active' ? <X className="size-4" /> : <CheckCircle2 className="size-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 text-gray-400 hover:text-[#ef4444] hover:bg-[#ef4444]/10 rounded transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#1f1f2e] flex items-center justify-between">
              <div>
                <h2 className="text-xl text-white font-medium">Add New User</h2>
                <p className="text-sm text-gray-400 mt-1">Create a new user account with secure credentials</p>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Security Notice */}
              <div className="bg-[#4f46e5]/10 border border-[#4f46e5]/30 rounded-lg p-4 flex items-start gap-3">
                <Lock className="size-5 text-[#4f46e5] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-white font-medium mb-1">Security Notice</h4>
                  <p className="text-sm text-gray-300">
                    All passwords are cryptographically hashed using bcrypt with SHA-256 before storage. 
                    Credentials are transmitted over secure TLS connections and never stored in plain text.
                  </p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
                    <UserCircle2 className="size-4" />
                    Username *
                  </label>
                  <input
                    type="text"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    placeholder="e.g., john.doe"
                    className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
                    <Mail className="size-4" />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    placeholder="e.g., john.doe@company.com"
                    className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
                  <User className="size-4" />
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                  placeholder="e.g., John Doe"
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                  required
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
                  <Shield className="size-4" />
                  Assigned Role *
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as any })}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="security-analyst">Security Analyst - Monitoring & advisory</option>
                  <option value="administrator">Administrator - Full system access</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
                    <Lock className="size-4" />
                    Password *
                  </label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="Enter secure password"
                    className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                    required
                  />
                  {newUserForm.password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Password Strength:</span>
                        <span className={`text-xs font-medium ${getPasswordStrengthLabel().color}`}>
                          {getPasswordStrengthLabel().label}
                        </span>
                      </div>
                      <div className="w-full bg-[#1a1a24] rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            passwordStrength <= 1 ? 'bg-[#ef4444]' : 
                            passwordStrength <= 3 ? 'bg-[#f59e0b]' : 'bg-[#10b981]'
                          }`}
                          style={{ width: `${(passwordStrength / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
                    <Lock className="size-4" />
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={newUserForm.confirmPassword}
                    onChange={(e) => setNewUserForm({ ...newUserForm, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                    required
                  />
                  {newUserForm.confirmPassword && (
                    <div className="mt-2">
                      {newUserForm.password === newUserForm.confirmPassword ? (
                        <div className="flex items-center gap-1.5 text-xs text-[#10b981]">
                          <CheckCircle2 className="size-3" />
                          Passwords match
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-[#ef4444]">
                          <AlertTriangle className="size-3" />
                          Passwords do not match
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded p-3">
                <p className="text-xs text-gray-400 mb-2">Password Requirements:</p>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className={newUserForm.password.length >= 12 ? 'text-[#10b981]' : 'text-gray-500'}>
                      {newUserForm.password.length >= 12 ? '✓' : '○'}
                    </span>
                    At least 12 characters
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={/[a-z]/.test(newUserForm.password) && /[A-Z]/.test(newUserForm.password) ? 'text-[#10b981]' : 'text-gray-500'}>
                      {/[a-z]/.test(newUserForm.password) && /[A-Z]/.test(newUserForm.password) ? '✓' : '○'}
                    </span>
                    Uppercase and lowercase letters
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={/\d/.test(newUserForm.password) ? 'text-[#10b981]' : 'text-gray-500'}>
                      {/\d/.test(newUserForm.password) ? '✓' : '○'}
                    </span>
                    At least one number
                  </li>
                  <li className="flex items-center gap-2">
                    <span className={/[^a-zA-Z0-9]/.test(newUserForm.password) ? 'text-[#10b981]' : 'text-gray-500'}>
                      {/[^a-zA-Z0-9]/.test(newUserForm.password) ? '✓' : '○'}
                    </span>
                    Special character (!@#$%^&*)
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-[#1f1f2e] flex items-center justify-between">
              <p className="text-xs text-gray-400">
                <Lock className="size-3 inline mr-1" />
                Password will be hashed using bcrypt + SHA-256
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white rounded transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={
                    !newUserForm.username ||
                    !newUserForm.email ||
                    !newUserForm.fullName ||
                    !newUserForm.password ||
                    newUserForm.password !== newUserForm.confirmPassword ||
                    passwordStrength < 3
                  }
                  className="px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg max-w-lg w-full">
            <div className="p-6 border-b border-[#1f1f2e] flex items-center justify-between">
              <div>
                <h2 className="text-xl text-white font-medium">Edit User</h2>
                <p className="text-sm text-gray-400 mt-1">{selectedUser.username}</p>
              </div>
              <button
                onClick={() => setShowEditUserModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24] rounded transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">User ID</label>
                <input
                  type="text"
                  value={selectedUser.id}
                  disabled
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-gray-500 rounded"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Assigned Role</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => updateUserRole(e.target.value as any)}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#4f46e5] transition-colors rounded"
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="security-analyst">Security Analyst - Monitoring & advisory</option>
                  <option value="administrator">Administrator - Full system access</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Account Status</label>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 border rounded ${getStatusColor(selectedUser.status)}`}>
                    {selectedUser.status.toUpperCase()}
                  </span>
                  <button
                    onClick={() => toggleUserStatus(selectedUser.id)}
                    className="text-sm text-[#4f46e5] hover:text-[#6366f1] transition-colors"
                  >
                    {selectedUser.status === 'active' ? 'Disable Account' : 'Enable Account'}
                  </button>
                </div>
              </div>

              <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded p-3">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <Calendar className="size-3" />
                  Account Information
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  <p>Created: {new Date(selectedUser.createdDate).toLocaleDateString()}</p>
                  <p>Last Login: {selectedUser.lastLogin === 'Never' ? 'Never' : new Date(selectedUser.lastLogin).toLocaleString()}</p>
                  <p>Total Logins: {selectedUser.loginCount}</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#1f1f2e] flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEditUserModal(false)}
                className="px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white rounded transition-colors text-sm"
              >
                Close
              </button>
              <button
                onClick={() => setShowEditUserModal(false)}
                className="px-4 py-2 bg-[#4f46e5] hover:bg-[#6366f1] text-white rounded transition-colors text-sm font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f17] border border-[#ef4444]/30 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-[#ef4444]/20 rounded-lg">
                  <AlertTriangle className="size-6 text-[#ef4444]" />
                </div>
                <div>
                  <h2 className="text-xl text-white font-medium">Delete User</h2>
                  <p className="text-sm text-gray-400">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-4">
                Are you sure you want to delete the user account <span className="font-mono text-white">{selectedUser.username}</span>? 
                All user data and access logs will be permanently removed.
              </p>

              <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded p-3 mb-4">
                <p className="text-xs text-[#ef4444]">
                  Warning: This will immediately revoke all access and cannot be reversed.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-[#1f1f2e] flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-gray-300 hover:text-white rounded transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded transition-colors text-sm font-medium"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
