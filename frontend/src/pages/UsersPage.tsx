import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { usersService } from '../api/services/users.service';
import { EmptyState } from '../components/shared/EmptyState';

export default function UsersPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const queryClient = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: usersService.list,
  });
  const createMutation = useMutation({
    mutationFn: usersService.create,
    onSuccess: () => {
      setUsername('');
      setEmail('');
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: usersService.delete,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl text-white">User Management</h2>
      <div className="bg-[#0f0f17] border border-[#1f1f2e] p-4 flex gap-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="bg-[#1a1a24] border border-[#2a2a3a] px-3 py-2 text-sm text-white"
        />
        <button
          type="button"
          onClick={() =>
            createMutation.mutate({
              username,
              email,
              password: 'ChangeMe123!',
              role: 'analyst',
            })
          }
          className="px-4 py-2 bg-[#4f46e5] text-white text-sm"
        >
          Add User
        </button>
      </div>
      {!usersQuery.data || usersQuery.data.length === 0 ? (
        <EmptyState title="No users found" description="Create users from this page or backend API." />
      ) : (
        <div className="bg-[#0f0f17] border border-[#1f1f2e] divide-y divide-[#1f1f2e]">
          {usersQuery.data.map((user) => (
            <div key={user.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="text-white">{user.username}</div>
                <div className="text-xs text-gray-400">
                  {user.email} • {user.role}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(user.id)}
                className="px-3 py-1.5 bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] text-sm"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
