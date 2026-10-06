import React, { useState } from 'react'
import ShopItem3DThumbnail from './ShopItem3DThumbnail'

export const SHOP_ITEMS = [
  // SMALL
  {
    id: 'stone_path',
    name: 'Stone Path',
    category: 'small',
    emoji: '🪨',
    description: 'A flat stone stepping tile for trails.',
    cost: 10,
  },
  {
    id: 'wooden_fence',
    name: 'Wooden Fence',
    category: 'small',
    emoji: '🪵',
    description: 'A rustic wooden fence segment.',
    cost: 10,
  },
  {
    id: 'mushroom_patch',
    name: 'Mushroom Patch',
    category: 'small',
    emoji: '🍄',
    description: 'A cozy cluster of wild red mushrooms.',
    cost: 15,
  },
  {
    id: 'log_seat',
    name: 'Log Seat',
    category: 'small',
    emoji: '🪑',
    description: 'A chopped timber log to sit and rest.',
    cost: 15,
  },
  {
    id: 'flower_bed',
    name: 'Flower Bed',
    category: 'small',
    emoji: '🌷',
    description: 'A vibrant bed of pink and yellow blossoms.',
    cost: 20,
  },
  {
    id: 'lantern_post',
    name: 'Lantern Post',
    category: 'small',
    emoji: '🏮',
    description: 'A glowing lantern on a carved wooden post.',
    cost: 30,
  },

  // MEDIUM
  {
    id: 'picnic_table',
    name: 'Picnic Table',
    category: 'medium',
    emoji: '🥪',
    description: 'A wooden table with benches for gatherings.',
    cost: 50,
  },
  {
    id: 'statue',
    name: 'Stone Cairn',
    category: 'medium',
    emoji: '🗿',
    description: 'A mystical stacked stone monument.',
    cost: 60,
  },
  {
    id: 'birdhouse',
    name: 'Birdhouse',
    category: 'medium',
    emoji: '🐦',
    description: 'A tall wooden birdhouse for forest birds.',
    cost: 75,
  },
  {
    id: 'hammock',
    name: 'Hammock',
    category: 'medium',
    emoji: '🛏️',
    description: 'A relaxing hammock hung between cedar poles.',
    cost: 90,
  },
  {
    id: 'campsite',
    name: 'Camping Site',
    category: 'medium',
    emoji: '🏕️',
    description: 'A crackling campfire with two colored tents.',
    cost: 100,
  },
  {
    id: 'well',
    name: 'Wishing Well',
    category: 'medium',
    emoji: '🪣',
    description: 'A classic stone well with wooden roof & water.',
    cost: 120,
  },

  // LARGE
  {
    id: 'gazebo',
    name: 'Wooden Gazebo',
    category: 'large',
    emoji: '⛩️',
    description: 'A peaceful pavilion with lantern illumination.',
    cost: 300,
  },
  {
    id: 'fountain',
    name: 'Grand Fountain',
    category: 'large',
    emoji: '⛲',
    description: 'A cascading stone water fountain.',
    cost: 350,
  },
  {
    id: 'watchtower',
    name: 'Watchtower',
    category: 'large',
    emoji: '🗼',
    description: 'A tall lookout tower with ladder & viewing deck.',
    cost: 400,
  },
  {
    id: 'tori_gate',
    name: 'Tori Gate',
    category: 'large',
    emoji: '⛩️',
    description: 'A magnificent traditional crimson gate.',
    cost: 450,
  },
  {
    id: 'windmill',
    name: 'Rustic Windmill',
    category: 'large',
    emoji: '🌾',
    description: 'A tall stone windmill with rotating canvas sails.',
    cost: 500,
  },
  {
    id: 'crystal',
    name: 'Giant Crystal',
    category: 'large',
    emoji: '💎',
    description: 'A glowing, floating arcane crystal monument.',
    cost: 600,
  }
]

export default function ShopModal({ isOpen, onClose, points = 0, onBuy }) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedItemId, setSelectedItemId] = useState(null)

  if (!isOpen) return null

  const filteredItems = activeCategory === 'all'
    ? SHOP_ITEMS
    : SHOP_ITEMS.filter(item => item.category === activeCategory)

  const selectedItem = SHOP_ITEMS.find(i => i.id === selectedItemId) || filteredItems[0]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div 
        className="relative flex flex-col w-full max-w-5xl rounded-3xl forest-panel shadow-2xl border border-white/10 text-white overflow-hidden max-h-[92vh] md:max-h-[86vh]"
      >
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#102016]/90 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#a8d878]/15 border border-[#a8d878]/30 text-xl shadow-inner">
              🌲
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#eef8ea]">Forest Shop</h2>
              <p className="text-xs text-[#a3c4b1]">Decorate your floating island with 3D landmarks & nature</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Points Balance Pill */}
            <div className="flex items-center gap-2 rounded-full border border-[#a8d878]/40 bg-[#162f20] px-4 py-1.5 shadow-sm">
              <span className="text-[#a8d878] font-black text-sm">✦</span>
              <span className="font-extrabold text-sm text-[#f8fff4]">
                {points.toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-[#a8d878] uppercase tracking-wider">
                PTS
              </span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close shop"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Tabs Bar */}
        <div className="flex items-center justify-between border-b border-white/5 bg-[#0d1a12]/80 px-6 py-2.5 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Items', count: SHOP_ITEMS.length },
              { id: 'small', label: 'Small Decor', count: SHOP_ITEMS.filter(i => i.category === 'small').length },
              { id: 'medium', label: 'Landmarks', count: SHOP_ITEMS.filter(i => i.category === 'medium').length },
              { id: 'large', label: 'Grand Wonders', count: SHOP_ITEMS.filter(i => i.category === 'large').length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activeCategory === tab.id
                    ? 'bg-[#a8d878] text-[#0d1711] shadow-md shadow-[#a8d878]/20'
                    : 'bg-white/5 text-[#a3c4b1] hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                  activeCategory === tab.id ? 'bg-[#0d1711]/20 text-[#0d1711]' : 'bg-black/30 text-white/50'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="hidden sm:block text-xs text-[#a3c4b1]/60 font-medium">
            Drag 3D model to inspect
          </div>
        </div>

        {/* Main 3D Grid Content Area */}
        <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const canAfford = points >= item.cost
              const isSelected = selectedItem?.id === item.id

              return (
                <div 
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`group relative flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden bg-[#132318]/90 ${
                    isSelected
                      ? 'border-[#a8d878] ring-2 ring-[#a8d878]/30 shadow-xl shadow-black/40'
                      : 'border-white/10 hover:border-white/20 hover:bg-[#16291c]'
                  }`}
                >
                  {/* Category Pill Tag on 3D Thumbnail */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#a8d878]">
                    <span>{item.emoji}</span>
                    <span>{item.category}</span>
                  </div>

                  {/* 3D Item Viewport */}
                  <div className="p-2">
                    <ShopItem3DThumbnail
                      type={item.id}
                      className="h-44 w-full rounded-xl"
                      interactive={true}
                      isLive={isSelected}
                      onLiveToggle={() => setSelectedItemId(item.id)}
                    />
                  </div>

                  {/* Item Info & Actions */}
                  <div className="p-4 pt-2 flex flex-col flex-1 justify-between gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-extrabold text-base text-[#f8fff4] group-hover:text-[#a8d878] transition-colors">
                          {item.name}
                        </h3>
                        <span className="shrink-0 font-extrabold text-sm text-[#fef08a]">
                          {item.cost} pts
                        </span>
                      </div>
                      <p className="text-xs text-[#a3c4b1] line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Buy & Place Button */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium text-white/40">
                        {canAfford ? 'Ready to place' : `Need ${item.cost - points} more`}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onBuy(item)
                        }}
                        disabled={!canAfford}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm ${
                          canAfford 
                            ? 'bg-[#a8d878] text-[#0d1711] hover:bg-[#bcf08b] active:scale-95 shadow-[#a8d878]/25' 
                            : 'bg-white/5 text-white/30 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        {canAfford ? 'Buy & Place' : 'Locked'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer Note */}
        <div className="border-t border-white/10 bg-[#102016]/90 px-6 py-3 flex items-center justify-between text-xs text-[#a3c4b1] shrink-0">
          <span>Earn +10 points each day you complete your habits.</span>
          <span className="hidden sm:inline text-white/40">Click any item's 3D canvas to rotate & inspect</span>
        </div>
      </div>
    </div>
  )
}
