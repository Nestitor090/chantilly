document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEYS = {
        theme: 'chantilly-theme',
        favorites: 'chantilly-favorites',
        cart: 'chantilly-cart',
        welcome: 'chantilly-welcome-seen'
    };

    const WHATSAPP_NUMBER = '51924488934';

    const storage = {
        get(key, fallback) {
            try {
                const value = localStorage.getItem(key);
                return value === null ? fallback : JSON.parse(value);
            } catch (error) {
                return fallback;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (error) {
                console.warn('No se pudo guardar la preferencia en el navegador.', error);
            }
        }
    };

    const normalizeText = (text) => text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const createProductId = (category, name) => normalizeText(`${category}-${name}`)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const categorySources = [
        { modalId: 'modalChocolate', category: 'Chocolate' },
        { modalId: 'modalVainilla', category: 'Frutos y vainilla' },
        { modalId: 'modalExtras', category: 'Extras' }
    ];

    const products = categorySources.flatMap(({ modalId, category }) => {
        const modal = document.getElementById(modalId);
        if (!modal) return [];

        return [...modal.querySelectorAll('.modal-body .col-12')].map((item) => {
            const name = item.querySelector('h6')?.textContent.trim() ?? '';
            const description = item.querySelector('p')?.textContent.trim() ?? '';
            const priceText = item.querySelector('.text-fresa')?.textContent.trim() ?? 'S/ 0.00';
            const image = item.querySelector('img')?.getAttribute('src') ?? '';
            const price = Number(priceText.replace(/[^0-9.]/g, ''));

            return {
                id: createProductId(category, name),
                category,
                name,
                description,
                price,
                image
            };
        }).filter((product) => product.name && Number.isFinite(product.price));
    });

    const productsById = new Map(products.map((product) => [product.id, product]));
    const catalogGrid = document.getElementById('catalogGrid');
    const noResults = document.getElementById('noResults');
    const resultsCount = document.getElementById('resultsCount');
    const productSearch = document.getElementById('productSearch');
    const priceFilter = document.getElementById('priceFilter');
    const priceValue = document.getElementById('priceValue');
    const favoritesOnly = document.getElementById('favoritesOnly');
    const clearFilters = document.getElementById('clearFilters');
    const themeToggle = document.getElementById('themeToggle');
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartTotal = document.getElementById('cartTotal');
    const clearCart = document.getElementById('clearCart');
    const sendWhatsAppOrder = document.getElementById('sendWhatsAppOrder');

    const savedFavorites = storage.get(STORAGE_KEYS.favorites, []);
    const favorites = new Set(Array.isArray(savedFavorites) ? savedFavorites : []);
    const savedCart = storage.get(STORAGE_KEYS.cart, {});
    const cart = savedCart && typeof savedCart === 'object' ? savedCart : {};

    const formatPrice = (price) => `S/ ${price.toFixed(2)}`;

    function saveFavorites() {
        storage.set(STORAGE_KEYS.favorites, [...favorites]);
    }

    function saveCart() {
        storage.set(STORAGE_KEYS.cart, cart);
    }

    function getFilteredProducts() {
        const query = normalizeText(productSearch.value);
        const maximumPrice = Number(priceFilter.value);

        return products.filter((product) => {
            const searchableText = normalizeText(`${product.name} ${product.description} ${product.category}`);
            const matchesText = searchableText.includes(query);
            const matchesPrice = product.price <= maximumPrice;
            const matchesFavorite = !favoritesOnly.checked || favorites.has(product.id);
            return matchesText && matchesPrice && matchesFavorite;
        });
    }

    function renderCatalog() {
        const filteredProducts = getFilteredProducts();

        catalogGrid.innerHTML = filteredProducts.map((product) => {
            const isFavorite = favorites.has(product.id);
            const favoriteLabel = isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';

            return `
                <div class="col-sm-6 col-lg-4">
                    <article class="catalog-product-card">
                        <img class="catalog-product-image" src="${product.image}" alt="${product.name}" loading="lazy">
                        <button class="favorite-button ${isFavorite ? 'is-favorite' : ''}" type="button" data-action="favorite" data-product-id="${product.id}" aria-label="${favoriteLabel}: ${product.name}" aria-pressed="${isFavorite}">
                            <i class="${isFavorite ? 'fas' : 'far'} fa-heart" aria-hidden="true"></i>
                        </button>
                        <div class="catalog-product-body">
                            <span class="catalog-category">${product.category}</span>
                            <h4 class="h5 mt-2">${product.name}</h4>
                            <p class="text-muted small flex-grow-1">${product.description}</p>
                            <p class="text-fresa fw-bold fs-5">${formatPrice(product.price)}</p>
                            <button class="add-cart-button" type="button" data-action="add-cart" data-product-id="${product.id}">
                                <i class="fas fa-cart-plus me-2" aria-hidden="true"></i>Agregar al carrito
                            </button>
                        </div>
                    </article>
                </div>`;
        }).join('');

        noResults.classList.toggle('d-none', filteredProducts.length > 0);
        resultsCount.textContent = `${filteredProducts.length} de ${products.length} productos mostrados`;
        priceValue.textContent = `S/ ${priceFilter.value}`;
    }

    function toggleFavorite(productId) {
        if (!productsById.has(productId)) return;

        if (favorites.has(productId)) {
            favorites.delete(productId);
        } else {
            favorites.add(productId);
        }

        saveFavorites();
        renderCatalog();
    }

    function addToCart(productId) {
        if (!productsById.has(productId)) return;
        cart[productId] = (Number(cart[productId]) || 0) + 1;
        saveCart();
        renderCart();
    }

    function updateCartQuantity(productId, change) {
        if (!cart[productId]) return;
        cart[productId] += change;

        if (cart[productId] <= 0) {
            delete cart[productId];
        }

        saveCart();
        renderCart();
    }

    function renderCart() {
        const validEntries = Object.entries(cart)
            .map(([productId, quantity]) => ({ product: productsById.get(productId), quantity: Number(quantity) }))
            .filter(({ product, quantity }) => product && quantity > 0);

        const totalItems = validEntries.reduce((total, { quantity }) => total + quantity, 0);
        const totalPrice = validEntries.reduce((total, { product, quantity }) => total + product.price * quantity, 0);

        cartItems.innerHTML = validEntries.map(({ product, quantity }) => `
            <div class="cart-item">
                <img src="${product.image}" alt="${product.name}" loading="lazy">
                <div>
                    <p class="cart-item-name">${product.name}</p>
                    <span class="small text-fresa fw-bold">${formatPrice(product.price)}</span>
                    <div class="quantity-control" aria-label="Cantidad de ${product.name}">
                        <button type="button" data-cart-action="decrease" data-product-id="${product.id}" aria-label="Disminuir cantidad">−</button>
                        <span aria-live="polite">${quantity}</span>
                        <button type="button" data-cart-action="increase" data-product-id="${product.id}" aria-label="Aumentar cantidad">+</button>
                    </div>
                </div>
                <button class="remove-cart-item" type="button" data-cart-action="remove" data-product-id="${product.id}" aria-label="Quitar ${product.name} del carrito">
                    <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
            </div>`).join('');

        cartCount.textContent = totalItems;
        cartTotal.textContent = formatPrice(totalPrice);
        emptyCart.classList.toggle('d-none', validEntries.length > 0);
        cartItems.classList.toggle('d-none', validEntries.length === 0);
        clearCart.disabled = validEntries.length === 0;
        sendWhatsAppOrder.disabled = validEntries.length === 0;
    }

    function sendOrderToWhatsApp() {
        const validEntries = Object.entries(cart)
            .map(([productId, quantity]) => ({ product: productsById.get(productId), quantity: Number(quantity) }))
            .filter(({ product, quantity }) => product && quantity > 0);

        if (validEntries.length === 0) return;

        const totalPrice = validEntries.reduce((total, { product, quantity }) => total + product.price * quantity, 0);
        const orderLines = validEntries.map(({ product, quantity }) =>
            `• ${quantity} x ${product.name} (${formatPrice(product.price)} c/u)`
        );
        const message = [
            'Hola, Chantilly & Co. Quisiera realizar este pedido:',
            '',
            ...orderLines,
            '',
            `Total estimado: ${formatPrice(totalPrice)}`
        ].join('\n');

        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
        themeToggle.innerHTML = `<i class="fas ${isDark ? 'fa-sun' : 'fa-moon'}" aria-hidden="true"></i>`;
        themeToggle.setAttribute('aria-label', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
        themeToggle.setAttribute('title', isDark ? 'Activar modo claro' : 'Activar modo oscuro');
    }

    catalogGrid.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const productId = button.dataset.productId;
        if (button.dataset.action === 'favorite') {
            toggleFavorite(productId);
        }

        if (button.dataset.action === 'add-cart') {
            addToCart(productId);
            const originalContent = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check me-2" aria-hidden="true"></i>Agregado';
            setTimeout(() => {
                if (button.isConnected) button.innerHTML = originalContent;
            }, 900);
        }
    });

    cartItems.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-cart-action]');
        if (!button) return;

        const productId = button.dataset.productId;
        const action = button.dataset.cartAction;
        if (action === 'increase') updateCartQuantity(productId, 1);
        if (action === 'decrease') updateCartQuantity(productId, -1);
        if (action === 'remove') {
            delete cart[productId];
            saveCart();
            renderCart();
        }
    });

    productSearch.addEventListener('input', renderCatalog);
    priceFilter.addEventListener('input', renderCatalog);
    favoritesOnly.addEventListener('change', renderCatalog);

    clearFilters.addEventListener('click', () => {
        productSearch.value = '';
        priceFilter.value = priceFilter.max;
        favoritesOnly.checked = false;
        renderCatalog();
        productSearch.focus();
    });

    themeToggle.addEventListener('click', () => {
        const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        storage.set(STORAGE_KEYS.theme, nextTheme);
        applyTheme(nextTheme);
    });

    clearCart.addEventListener('click', () => {
        Object.keys(cart).forEach((productId) => delete cart[productId]);
        saveCart();
        renderCart();
    });

    sendWhatsAppOrder.addEventListener('click', sendOrderToWhatsApp);

    const savedTheme = storage.get(STORAGE_KEYS.theme, 'light');
    applyTheme(savedTheme === 'dark' ? 'dark' : 'light');
    renderCatalog();
    renderCart();

    const welcomeSeen = storage.get(STORAGE_KEYS.welcome, false);
    const welcomeToastElement = document.getElementById('welcomeToast');
    if (!welcomeSeen && welcomeToastElement && window.bootstrap) {
        const welcomeToast = new bootstrap.Toast(welcomeToastElement, { autohide: false });
        welcomeToast.show();
        storage.set(STORAGE_KEYS.welcome, true);
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
});
