import { useState, useEffect } from 'react';
import { Search, Loader2, X, Check, Users } from 'lucide-react';
import Modal from '@/components/Modal';
import Avatar from '@/components/Avatar';
import { useSearchUsers } from '@/hooks/useChats';
import { useAuth } from '@/context/AuthContext';
import { displayName } from '@/lib/utils';
import { createGroupChat } from '@/hooks/useChats';
import type { Profile } from '@/types';

interface NewGroupModalProps {
  open: boolean;
  onClose: () => void;
  onGroupCreated: (chatId: string) => void;
}

export default function NewGroupModal({ open, onClose, onGroupCreated }: NewGroupModalProps) {
  const { user } = useAuth();
  const { results, searching, search } = useSearchUsers();
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setGroupName('');
      setSelected([]);
      search('');
    }
  }, [open, search]);

  const toggleSelect = (profile: Profile) => {
    setSelected((prev) =>
      prev.some((p) => p.id === profile.id)
        ? prev.filter((p) => p.id !== profile.id)
        : [...prev, profile]
    );
  };

  const handleCreate = async () => {
    if (!user || !groupName.trim() || selected.length === 0) return;
    setCreating(true);
    const chatId = await createGroupChat(user.id, groupName.trim(), selected.map((p) => p.id));
    setCreating(false);
    if (chatId) {
      onGroupCreated(chatId);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New group" maxWidth="max-w-lg">
      <div className="p-5 space-y-4">
        {/* Group name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Group name
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name..."
            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-messenger-blue transition-all"
            autoFocus
          />
        </div>

        {/* Selected members */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-xl">
            {selected.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-white dark:bg-gray-600 rounded-full"
              >
                <Avatar profile={profile} size="xs" />
                <span className="text-sm text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
                  {displayName(profile)}
                </span>
                <button
                  onClick={() => toggleSelect(profile)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value, [user?.id || '', ...selected.map((p) => p.id)]);
            }}
            placeholder="Add members..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-messenger-blue transition-all"
          />
        </div>

        {/* Results */}
        {searching ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            {query ? 'No users found' : 'Search to add members'}
          </div>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-thin">
            {results.map((profile) => {
              const isSelected = selected.some((p) => p.id === profile.id);
              return (
                <button
                  key={profile.id}
                  onClick={() => toggleSelect(profile)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <Avatar profile={profile} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {displayName(profile)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{profile.username}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-messenger-blue border-messenger-blue text-white'
                        : 'border-gray-300 dark:border-gray-500'
                    }`}
                  >
                    {isSelected && <Check size={14} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={!groupName.trim() || selected.length === 0 || creating}
          className="w-full py-3 rounded-xl bg-messenger-blue hover:bg-messenger-blue-dark text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {creating ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <>
              <Users size={18} />
              Create group ({selected.length + 1} members)
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
