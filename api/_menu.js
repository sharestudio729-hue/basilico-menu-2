// Builds the final, merged menu (base items + admin overrides + new items -
// deleted items) that both the public site and the admin panel read.

const { MENU, VERIFIED_ITEM_PHOTOS } = require('./_data.js');
const { readState, readStateFresh } = require('./_store.js');

function buildMenu(state) {
  const deleted = new Set((state.deletedIds || []).map(String));
  const overrides = state.overrides || {};

  const baseItems = MENU.filter((it) => !deleted.has(String(it.id))).map((it) => {
    const ov = overrides[String(it.id)] || {};
    return {
      id: it.id,
      name: typeof ov.name === 'string' && ov.name.trim() ? ov.name : it.name,
      category: typeof ov.category === 'string' && ov.category.trim() ? ov.category : it.category,
      price: typeof ov.price === 'number' ? ov.price : it.price,
      photo: typeof ov.photo === 'string' && ov.photo ? ov.photo : (VERIFIED_ITEM_PHOTOS[String(it.id)] || null),
      available: typeof ov.available === 'boolean' ? ov.available : true,
      stock: ov.stock === null || typeof ov.stock === 'number' ? ov.stock : null,
      isNew: false,
    };
  });

  const newItems = (state.newItems || []).map((it) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    price: it.price,
    photo: it.photo || null,
    available: typeof it.available === 'boolean' ? it.available : true,
    stock: it.stock === null || typeof it.stock === 'number' ? it.stock : null,
    isNew: true,
  }));

  return baseItems.concat(newItems);
}

async function getMergedMenu(fresh) {
  const state = fresh ? await readStateFresh() : await readState();
  return { items: buildMenu(state), state };
}

module.exports = { buildMenu, getMergedMenu };
