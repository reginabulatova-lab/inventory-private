"use client";

const items = [
  { name: "Wireless Mouse", sku: "WM-102", category: "Accessories", stock: 20 },
  { name: "USB-C Charger", sku: "UC-309", category: "Chargers", stock: 3 },
  { name: "Mechanical Keyboard", sku: "MK-501", category: "Keyboards", stock: 0 },
];

function status(stock: number) {
  if (stock === 0) return { label: "Out of Stock", cls: "bg-red-100 text-red-700" };
  if (stock <= 5) return { label: "Low Stock", cls: "bg-yellow-100 text-yellow-800" };
  return { label: "In Stock", cls: "bg-green-100 text-green-700" };
}

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Inventory Control Tower</h1>
            <p className="text-gray-500">Quick prototype dashboard</p>
          </div>
          <button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            + Add item
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow">
            <div className="text-sm text-gray-500">Total items</div>
            <div className="text-2xl font-semibold">{items.length}</div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow">
            <div className="text-sm text-gray-500">Low stock</div>
            <div className="text-2xl font-semibold">
              {items.filter((i) => i.stock > 0 && i.stock <= 5).length}
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow">
            <div className="text-sm text-gray-500">Out of stock</div>
            <div className="text-2xl font-semibold">
              {items.filter((i) => i.stock === 0).length}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white shadow">
          <div className="border-b p-4">
            <input
              className="w-full rounded-md border px-3 py-2"
              placeholder="Search (prototype placeholder)"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs uppercase text-gray-500">
                <tr className="border-b">
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">SKU</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Stock</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((i) => {
                  const s = status(i.stock);
                  return (
                    <tr key={i.sku}>
                      <td className="px-6 py-4">{i.name}</td>
                      <td className="px-6 py-4 text-gray-600">{i.sku}</td>
                      <td className="px-6 py-4 text-gray-600">{i.category}</td>
                      <td className="px-6 py-4">{i.stock}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

