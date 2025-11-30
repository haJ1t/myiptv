import React, { useState, useMemo } from 'react';
import { Channel, ChannelGroup } from '../types';
import '../styles/ChannelList.css';

interface ChannelListProps {
  groups: ChannelGroup[];
  currentChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
}

const ChannelList: React.FC<ChannelListProps> = ({ 
  groups, 
  currentChannel, 
  onChannelSelect 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));

  // Filtrelenmiş gruplar
  const filteredGroups = useMemo(() => {
    let filtered = groups;

    // Grup filtresi
    if (selectedGroup !== 'all') {
      filtered = groups.filter(g => g.name === selectedGroup);
    }

    // Arama filtresi
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.map(group => ({
        ...group,
        channels: group.channels.filter(channel =>
          channel.name.toLowerCase().includes(query) ||
          channel.group?.toLowerCase().includes(query)
        )
      })).filter(group => group.channels.length > 0);
    }

    return filtered;
  }, [groups, selectedGroup, searchQuery]);

  // Toplam kanal sayısı
  const totalChannels = useMemo(() => {
    return filteredGroups.reduce((sum, group) => sum + group.channels.length, 0);
  }, [filteredGroups]);

  // Grup toggle
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  return (
    <div className="channel-list">
      {/* Header */}
      <div className="channel-list-header">
        <h2>Kanallar</h2>
        <span className="channel-count">{totalChannels} kanal</span>
      </div>

      {/* Search */}
      <div className="search-box">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8" strokeWidth="2"/>
          <path d="m21 21-4.35-4.35" strokeWidth="2"/>
        </svg>
        <input
          type="text"
          placeholder="Kanal ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery('')}>
            ×
          </button>
        )}
      </div>

      {/* Group filter */}
      <div className="group-filter">
        <select 
          value={selectedGroup} 
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          <option value="all">Tüm Gruplar</option>
          {groups.map(group => (
            <option key={group.name} value={group.name}>
              {group.name} ({group.channels.length})
            </option>
          ))}
        </select>
      </div>

      {/* Channel groups */}
      <div className="channel-groups">
        {filteredGroups.length === 0 ? (
          <div className="no-results">
            <p>Kanal bulunamadı</p>
          </div>
        ) : (
          filteredGroups.map(group => (
            <div key={group.name} className="channel-group">
              <div 
                className="group-header"
                onClick={() => toggleGroup(group.name)}
              >
                <span className="group-name">{group.name}</span>
                <span className="group-count">{group.channels.length}</span>
                <svg 
                  className={`expand-icon ${expandedGroups.has(group.name) ? 'expanded' : ''}`}
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor"
                >
                  <polyline points="6 9 12 15 18 9" strokeWidth="2"/>
                </svg>
              </div>

              {expandedGroups.has(group.name) && (
                <div className="group-channels">
                  {group.channels.map(channel => (
                    <div
                      key={channel.id}
                      className={`channel-item ${currentChannel?.id === channel.id ? 'active' : ''}`}
                      onClick={() => onChannelSelect(channel)}
                    >
                      {channel.logo && (
                        <img 
                          src={channel.logo} 
                          alt={channel.name}
                          className="channel-item-logo"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="channel-item-info">
                        <span className="channel-item-name">{channel.name}</span>
                        {channel.quality && (
                          <span className={`channel-item-quality quality-${channel.quality.toLowerCase()}`}>
                            {channel.quality}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChannelList;
