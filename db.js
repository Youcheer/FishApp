// db.js
const db = new Dexie('FishMartDB');

db.version(7).stores({
    shops: '++id, name, location',
    fish_items: '++id, [shopId+name], name, wholesalePrice, retailPrice, stockRemaining, shopId',
    sales: '++id, date, shopId, fishId, saleType, weight, totalAmount, paymentType, customerId',
    expenses: '++id, date, shopId, category, amount, description',
    purchases: '++id, date, shopId, fishName, weight, totalCost, billImage',
    wastage: '++id, date, shopId, fishName, weight, estimatedLoss',
    transfers: '++id, date, fromShopId, toShopId, fishName, weight',
    master_fish: '++id, name',
    users: '++id, username, password, role, shopId',
    customers: '++id, name, phone',
    customer_payments: '++id, date, customerId, amount'
});

async function initializeDB() {
    try {
        const userCount = await db.users.count();
        if (userCount === 0) {
            await db.users.bulkAdd([
                { username: 'admin', password: '123', role: 'admin', shopId: null },
                { username: 'shop1', password: '123', role: 'shop_user', shopId: 1 },
                { username: 'shop2', password: '123', role: 'shop_user', shopId: 2 },
                { username: 'shop3', password: '123', role: 'shop_user', shopId: 3 }
            ]);
        }

        const shopCount = await db.shops.count();
        if (shopCount === 0) {
            await db.shops.bulkAdd([
                { name: 'Shop 1', location: 'Main Branch' },
                { name: 'Shop 2', location: 'City Center' },
                { name: 'Shop 3', location: 'North Wing' }
            ]);

            await db.fish_items.bulkAdd([
                { name: 'Tuna (Kelawalla)', wholesalePrice: 1500, retailPrice: 1800, stockRemaining: 100, shopId: 1 },
                { name: 'Seer (Thora)', wholesalePrice: 2000, retailPrice: 2500, stockRemaining: 50, shopId: 1 },
                { name: 'Mullet (Godaya)', wholesalePrice: 800, retailPrice: 1000, stockRemaining: 80, shopId: 2 },
                { name: 'Tuna (Kelawalla)', wholesalePrice: 1500, retailPrice: 1800, stockRemaining: 120, shopId: 2 },
                { name: 'Sailfish (Koppara)', wholesalePrice: 1200, retailPrice: 1500, stockRemaining: 5, shopId: 3 }
            ]);
        }

        const fishCount = await db.master_fish.count();
        if (fishCount === 0) {
            const initialFish = [
                "Issa (Prawns/Shrimp)", "Kakuluwa (Crab)", "Ballo / Duella (Cuttlefish/Squid)",
                "Pokirissa (Lobster)", "Thilapiya (Tilapia)", "Lula (Snakehead)", "Walaya (Wallago)",
                "Petiya (Barb)", "Hirikanaya (Labeo)", "Hurulla (Trenched Sardine)",
                "Salaya (Goldstripe Sardine)", "Sudaya (White Sardine)", "Kumbala (Indian Mackerel)",
                "Bolla (Bigeye Scad)", "Linna (Hardtail Scad)", "Handalla (Anchovy)",
                "Karalla (Ponyfish)", "Kelawalla (Yellowfin Tuna)", "Balaya (Skipjack Tuna)",
                "Thora (Seer Fish / King Mackerel)", "Paraw (Trevally)", "Mora (Shark)",
                "Koppara (Cobia)", "Talpath (Sailfish)", "Kattalla (Queenfish)", "Alagoduwa (Frigate Tuna)"
            ];
            await db.master_fish.bulkAdd(initialFish.map(f => ({ name: f })));
        }
    } catch (e) {
        console.error("Failed to initialize DB:", e);
    }
}

initializeDB();
