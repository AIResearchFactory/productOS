/* ═══════════════════════════════════════════════════════════
   productOS Landing Page — script.js
   ═══════════════════════════════════════════════════════════ */

/* ── Canvas Particle Background ─────────────────────────── */
(function initCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles = [], animId;

    function resize() {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function createParticle() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.5 + 0.5,
            alpha: Math.random() * 0.5 + 0.1,
            color: Math.random() > 0.5 ? '0,212,184' : '124,58,237'
        };
    }

    function init() {
        particles = [];
        const count = Math.floor((W * H) / 15000);
        for (let i = 0; i < count; i++) particles.push(createParticle());
    }

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    const opacity = (1 - dist / 120) * 0.08;
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0,212,184,${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    function loop() {
        ctx.clearRect(0, 0, W, H);

        // Draw ambient gradient orbs
        const g1 = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, 400);
        g1.addColorStop(0, 'rgba(0,212,184,0.04)');
        g1.addColorStop(1, 'transparent');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, W, H);

        const g2 = ctx.createRadialGradient(W * 0.8, H * 0.6, 0, W * 0.8, H * 0.6, 350);
        g2.addColorStop(0, 'rgba(124,58,237,0.05)');
        g2.addColorStop(1, 'transparent');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);

        drawConnections();

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = W;
            if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H;
            if (p.y > H) p.y = 0;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
            ctx.fill();
        });

        animId = requestAnimationFrame(loop);
    }

    resize();
    init();
    loop();
    window.addEventListener('resize', () => { resize(); init(); });
})();

/* ── Sticky Nav ─────────────────────────────────────────── */
(function initNav() {
    const nav = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 20);
    });
})();

/* ── Mobile Hamburger ───────────────────────────────────── */
(function initHamburger() {
    const btn = document.getElementById('nav-hamburger');
    const menu = document.getElementById('nav-mobile-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', () => {
        menu.classList.toggle('open');
    });
    menu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => { menu.classList.remove('open'); });
    });
})();

/* ── Scroll Reveal (Intersection Observer) ──────────────── */
(function initReveal() {
    const items = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                observer.unobserve(e.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => observer.observe(el));
})();

/* ── Animated Counters ──────────────────────────────────── */
(function initCounters() {
    const counters = document.querySelectorAll('.stat-num[data-target]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            const el = e.target;
            const target = parseInt(el.dataset.target, 10);
            const duration = 1800;
            const start = performance.now();
            function update(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
                el.textContent = Math.round(ease * target);
                if (progress < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
            observer.unobserve(el);
        });
    }, { threshold: 0.5 });
    counters.forEach(c => observer.observe(c));
})();

/* ── Time Savings Bars ──────────────────────────────────── */
(function initBars() {
    const bars = document.querySelectorAll('.time-fill');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            // width already set in CSS; just trigger reflow for transition
            const bar = e.target;
            const width = bar.style.width;
            bar.style.width = '0%';
            setTimeout(() => { bar.style.width = width; }, 100);
            observer.unobserve(bar);
        });
    }, { threshold: 0.4 });
    bars.forEach(b => observer.observe(b));
})();

/* ── Smooth scroll for anchor links ─────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

/* ── Nav logo bounce on click ───────────────────────────── */
(function initLogoClick() {
    const logo = document.getElementById('nav-logo-link');
    if (!logo) return;
    logo.addEventListener('click', e => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

/* ── Tilt effect on feature highlight images ─────────────── */
(function initTilt() {
    const imgs = document.querySelectorAll('.feature-highlight-visual img');
    imgs.forEach(img => {
        img.parentElement.addEventListener('mousemove', e => {
            const rect = img.parentElement.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (e.clientX - cx) / rect.width;
            const dy = (e.clientY - cy) / rect.height;
            img.style.transform = `perspective(800px) rotateY(${dx * 5}deg) rotateX(${-dy * 5}deg) scale(1.02)`;
        });
        img.parentElement.addEventListener('mouseleave', () => {
            img.style.transform = '';
        });
    });
})();

/* ── Hero image float animation ─────────────────────────── */
(function initHeroFloat() {
    const img = document.getElementById('hero-screenshot');
    if (!img) return;
    let t = 0;
    function animate() {
        t += 0.012;
        img.style.transform = `translateY(${Math.sin(t) * 8}px)`;
        requestAnimationFrame(animate);
    }
    animate();
})();

console.log('%c🚀 productOS', 'color:#00d4b8;font-size:1.4rem;font-weight:800;');
console.log('%cResearch smarter. Own your data.', 'color:#8b949e;font-size:0.9rem;');

/**
 * FAQ Accordion Toggle
 */
function toggleFaq(element) {
    const item = element.parentElement;
    const isActive = item.classList.contains('active');
    
    // Close all other FAQ items (optional, but cleaner)
    document.querySelectorAll('.faq-item').forEach(faq => {
        faq.classList.remove('active');
    });
    
    if (!isActive) {
        item.classList.add('active');
    }
}
