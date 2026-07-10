import React from 'react'

export const SHOP_ITEMS = [
  // SMALL
  {
    id: 'stone_path',
    name: 'Stone Path',
    category: 'small',
    emoji: '🪨',
    description: 'A flat stone stepping tile.',
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
    description: 'A cluster of red mushrooms.',
    cost: 15,
  },
  {
    id: 'log_seat',
    name: 'Log Seat',
    category: 'small',
    emoji: '🪑',
    description: 'A simple chopped log to sit on.',
    cost: 15,
  },
  {
    id: 'flower_bed',
    name: 'Flower Bed',
    category: 'small',
    emoji: '🌷',
    description: 'A beautiful patch of vibrant flowers.',
    cost: 20,
  },
  {
    id: 'lantern_post',
    name: 'Lantern Post',
    category: 'small',
    emoji: '🏮',
    description: 'A glowing lantern on a wooden post.',
    cost: 30,
  },

  // MEDIUM
  {
    id: 'picnic_table',
    name: 'Picnic Table',
    category: 'medium',
    emoji: '🥪',
    description: 'A wooden table for resting.',
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
    description: 'A cute birdhouse on a tall pole.',
    cost: 75,
  },
  {
    id: 'hammock',
    name: 'Hammock',
    category: 'medium',
    emoji: '🛏️',
    description: 'A relaxing hammock tied between poles.',
    cost: 90,
  },
  {
    id: 'campsite',
    name: 'Camping Site',
    category: 'medium',
    emoji: '🏕️',
    description: 'A cozy campfire and two tents.',
    cost: 100,
  },
  {
    id: 'well',
    name: 'Wishing Well',
    category: 'medium',
    emoji: '🪣',
    description: 'A classic stone well with a wooden roof.',
    cost: 120,
  },

  // LARGE
  {
    id: 'gazebo',
    name: 'Wooden Gazebo',
    category: 'large',
    emoji: '⛩️',
    description: 'A beautiful resting place with a warm central glow.',
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
    description: 'A tall wooden lookout tower.',
    cost: 400,
  },
  {
    id: 'tori_gate',
    name: 'Tori Gate',
    category: 'large',
    emoji: '⛩️',
    description: 'A massive traditional red gateway.',
    cost: 450,
  },
  {
    id: 'windmill',
    name: 'Rustic Windmill',
    category: 'large',
    emoji: '🌾',
    description: 'A majestic windmill with spinning sails.',
    cost: 500,
  },
  {
    id: 'crystal',
    name: 'Giant Crystal',
    category: 'large',
    emoji: '💎',
    description: 'A massive, glowing magical crystal.',
    cost: 600,
  }
]

export default function ShopModal({ isOpen, onClose, points, inventory, onBuy }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#16271c] shadow-2xl text-white flex flex-col" style={{ maxHeight: '85vh' }}>
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-5 py-4 shrink-0">
          <h2 className="text-xl font-bold text-[#eef8ea]">Forest Shop</h2>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#a8d878]/20 px-3 py-1 text-sm font-bold text-[#a8d878]">
              {points} pts
            </span>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {['small', 'medium', 'large'].map((category) => {
            const categoryItems = SHOP_ITEMS.filter(i => i.category === category)
            if (categoryItems.length === 0) return null

            return (
              <div key={category}>
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3 px-1">{category} Items</h3>
                <div className="space-y-3">
                  {categoryItems.map((item) => {
                    const canAfford = points >= item.cost

                    return (
                      <div 
                        key={item.id}
                        className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl">
                          {item.emoji}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-[#eef8ea]">{item.name}</h3>
                          <p className="text-xs text-white/50">{item.description}</p>
                        </div>
                        <div className="shrink-0">
                          <button
                            onClick={() => onBuy(item)}
                            disabled={!canAfford}
                            className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                              canAfford 
                                ? 'bg-[#a8d878] text-[#16271c] hover:bg-[#bce694]' 
                                : 'bg-white/5 text-white/30 cursor-not-allowed'
                            }`}
                          >
                            {item.cost} pts
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
