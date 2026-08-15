"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AOS from "aos";
import "aos/dist/aos.css";

export default function HomePage() {
  const router = useRouter();

  // 开始使用：进入手机通话模拟（纯网页版，浏览器内完成语音）
  function startPhone() {
    router.push("/phone");
  }

  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: "ease-out-cubic",
      once: true,
      offset: 80,
      disable: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
  }, []);

  // ---- Hero 视差 + 导航滚动态（原 index.html 内联脚本移植） ----
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>("#hero");
    const heroBg = document.querySelector<HTMLElement>(".hero-bg");
    const heroWordmark = document.querySelector<HTMLElement>(".hero-wordmark");
    const heroContent = document.querySelector<HTMLElement>(".hero-content");
    const nav = document.querySelector<HTMLElement>(".nav-floating");
    if (!hero) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function onScroll() {
      const scrollY = window.scrollY;
      const heroH = hero?.offsetHeight ?? 0;

      if (scrollY < heroH) {
        if (!reduceMotion) {
          if (heroBg) heroBg.style.transform = `translateY(${scrollY * 0.4}px)`;
          if (heroWordmark) {
            const scale = Math.max(0.85, 1 - (scrollY / heroH) * 0.15);
            heroWordmark.style.transform = `translateY(${scrollY * -0.25}px) scale(${scale})`;
            heroWordmark.style.opacity = String(
              Math.max(0, 1 - (scrollY / heroH) * 1.1)
            );
          }
          if (heroContent) {
            heroContent.style.transform = `translateY(${scrollY * 0.15}px)`;
            heroContent.style.opacity = String(
              Math.max(0, 1 - scrollY / (heroH * 0.6))
            );
          }
        }
      }

      if (nav) {
        if (scrollY > 60) nav.classList.add("is-scrolled");
        else nav.classList.remove("is-scrolled");
      }
    }

    let ticking = false;
    const onScrollTick = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          onScroll();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScrollTick, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScrollTick);
  }, []);

  return (
    <main>
      {/* ============ HERO 全屏区块 ============ */}
      <section
        id="hero"
        className="relative w-full h-screen min-h-[700px] overflow-hidden"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1609220136736-443140cffec6?auto=format&fit=crop&w=2000&q=80"
          alt="Multi-generational family in golden-hour garden light"
          className="hero-bg absolute inset-0 w-full h-full object-cover"
          style={{ willChange: "transform", transition: "transform 0.1s linear" }}
        />
        <div className="absolute inset-0 hero-overlay"></div>

        {/* 悬浮导航 */}
        <nav className="nav-floating relative z-20 flex items-center justify-between w-full max-w-[1200px] mx-auto px-[34px] py-[18px]">
          <Link
            href="/"
            className="nav-brand flex items-center gap-[10px] text-white"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <path d="M12 21c0-6 0-9 0-9M12 12C12 7 7 4 3 4c0 5 4 8 9 8zM12 12c0-5 5-8 9-8 0 5-4 8-9 8z" />
            </svg>
            <span className="text-white text-[24px] leading-none font-semibold">小棉袄</span>
          </Link>

          <div className="flex items-center gap-[20px]">
            <Link
              href="/board"
              className="nav-link text-white text-[16px] tracking-[-0.32px]"
            >
              看板
            </Link>
            <Link
              href="/reports"
              className="nav-link text-white text-[16px] tracking-[-0.32px]"
            >
              汇报
            </Link>
            <Link
              href="/profile"
              className="nav-link text-white text-[16px] tracking-[-0.32px]"
            >
              档案
            </Link>
            <Link
              href="/profile"
              className="btn-ghost text-[#192830] bg-white border border-[#192830] rounded-[6px] px-[18px] py-[4px] text-[16px] tracking-[-0.32px]"
            >
              填写档案
            </Link>
          </div>
        </nav>

        {/* 标题区 */}
        <div className="hero-content relative z-10 max-w-[1200px] mx-auto px-[34px] mt-[90px]">
          <h1 className="text-white text-[48px] leading-[1.1] tracking-[-1.5px] max-w-[560px] font-medium">
            每天一通电话，
            <br />
            让爱不被距离稀释。
          </h1>
          <p className="text-white/90 text-[16px] leading-[1.5] tracking-[-0.32px] max-w-[440px] mt-[18px]">
            小棉袄主动给独居老人打电话——聊天、提醒吃药、留意心情、紧急时联系家人。子女随时看到老人今天过得好不好。
          </p>

          {/* 模拟原型说明（白字） */}
          <p className="text-white text-[14px] leading-[1.6] tracking-[-0.2px] max-w-[440px] mt-[24px] font-medium">
            ！！！此项目，需要结合实际的手机硬件，这里做个模拟原型来模拟手机通话，请点击下面的开始使用或者手机屏幕吧
          </p>

          {/* 直接开始使用 */}
          <div className="flex items-center gap-[14px] mt-[18px] flex-wrap">
            <button
              type="button"
              onClick={startPhone}
              className="btn-primary inline-flex items-center gap-[8px] bg-[#192830] text-white rounded-[4px] px-[20px] py-[0px] text-[16px] tracking-[-0.32px] leading-[44px]"
            >
              直接开始使用
              <span className="arrow text-[18px]">→</span>
            </button>
          </div>

          {/* 小猫打电话图片（点击进入通话原型） */}
          <button
            type="button"
            onClick={startPhone}
            className="rounded-[16px] shadow-2xl block cursor-pointer transition-transform hover:scale-[1.02] mt-[28px]"
            title="点击进入手机通话模拟"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/static/caregiver.jpg"
              alt="小棉袄小猫打电话（点击直接开始使用）"
              className="rounded-[16px]"
              style={{ maxHeight: "280px", maxWidth: "100%", width: "auto", objectFit: "cover", display: "block" }}
            />
          </button>

          {/* 重新填写老人档案（猫咪图片下方） */}
          <div className="mt-[20px]">
            <Link
              href="/profile"
              className="btn-ghost inline-flex items-center gap-[8px] bg-white/90 text-[#192830] border border-[#192830] rounded-[4px] px-[20px] py-[0px] text-[16px] tracking-[-0.32px] leading-[42px]"
            >
              重新填写老人档案
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 关心，从来不是一个人的事 ============ */}
      <section className="relative bg-[#f5f5ee] py-[218px] overflow-hidden">
        <div className="relative max-w-[1200px] mx-auto px-[34px] min-h-[560px]">
          <div className="relative z-10 flex flex-col items-center text-center max-w-[640px] mx-auto pt-[80px]">
            <h2
              data-aos="fade-up"
              className="text-[#2f3136] text-[44px] leading-[1.15] tracking-[-1.5px] font-medium"
            >
              关心，从来不是一个人的事。
            </h2>
            <p
              data-aos="fade-up"
              data-aos-delay="150"
              className="text-[#535557] text-[20px] leading-[1.4] tracking-[-0.32px] max-w-[560px] mt-[24px]"
            >
              小棉袄每天替你打那通&ldquo;本来想打但太忙了&rdquo;的电话，然后把老人今天的状态——心情、身体、有没有什么心事——悄悄汇报给你。
            </p>

            <div data-aos="fade-up" data-aos-delay="300" className="mt-[40px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/static/hero-phone.jpg"
                alt="小棉袄手机界面"
                className="rounded-[16px] shadow-lg"
                style={{ maxWidth: 260, width: "100%", height: "auto" }}
              />
            </div>
          </div>

          {/* 散落头像 */}
          <Avatar
            className="top-[20px] left-[40px]"
            img="https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=200&q=80"
            label="妈妈"
            delay={100}
          />
          <Avatar
            className="top-[10px] right-[60px]"
            img="https://images.unsplash.com/photo-1633332755192-727a05c4013d?auto=format&fit=crop&w=200&q=80"
            label="爸爸"
            delay={200}
            floatDelay={1}
          />
          <Avatar
            className="top-[260px] left-[100px]"
            img="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=200&q=80"
            label="女儿"
            delay={300}
            floatDelay={2}
          />
          <Avatar
            className="top-[280px] right-[110px]"
            img="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80"
            label="儿子"
            delay={400}
            floatDelay={3}
          />
          <Avatar
            className="bottom-[20px] left-[140px]"
            img="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=200&q=80"
            label="小棉"
            delay={500}
            floatDelay={4}
          />
          <Avatar
            className="bottom-[10px] right-[150px]"
            img="https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=200&q=80"
            label="邻居"
            delay={600}
            floatDelay={5}
          />
        </div>
      </section>

      {/* ============ 三件小事，一份安心 ============ */}
      <section className="bg-[#f5f5ee] pt-[123px] pb-[80px]">
        <div className="max-w-[1200px] mx-auto px-[34px] flex flex-col items-center text-center">
          <span data-aos="fade-up" className="eyebrow">
            功能
          </span>
          <h2
            data-aos="fade-up"
            data-aos-delay="100"
            className="text-[#2f3136] text-[44px] leading-[1.15] tracking-[-1.5px] max-w-[640px] mt-[20px] font-medium"
          >
            三件小事，一份安心。
          </h2>
          <p
            data-aos="fade-up"
            data-aos-delay="200"
            className="text-[#535557] text-[20px] leading-[1.2] tracking-[-0.32px] max-w-[560px] mt-[24px]"
          >
            小棉袄不是监控，是一个会主动打电话、会记住细节、会在需要时找人的贴心伙伴。
          </p>
        </div>
      </section>

      {/* ============ 三列功能卡片 ============ */}
      <section className="bg-[#f5f5ee] pb-[200px]">
        <div className="max-w-[1200px] mx-auto px-[34px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[20px]">
            <FeatureCard
              href="/board"
              img="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&q=80"
              alt="每日通话"
              tag="每日通话"
              title="主动打电话，不是等老人找你。"
              text="小棉每天按时给老人去电，聊天气、问吃药、听Ta说说今天的事。声音温暖，像家里的侄女。"
              tint="#b3c4cd"
            />
            <FeatureCard
              href="/reports"
              img="https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80"
              alt="情绪关心"
              tag="情绪关心"
              title="听得出叹气，听得出哽咽。"
              text={'老人嘴上说"没事"，小棉能从语气里听出心事。想家了、不舒服了、跟邻居闹别扭了——都会悄悄告诉你。'}
              tint="#d7d7cb"
              delay={120}
            />
            <FeatureCard
              href="/board"
              img="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=600&q=80"
              alt="紧急联络"
              tag="紧急联络"
              title="摔了、不舒服，第一时间找你。"
              text={'老人说"摔了一跤"，小棉立刻稳住老人、评估伤情、联系家人。不用老人自己扛着。'}
              tint="#b3c4cd"
              delay={240}
            />
          </div>
        </div>
      </section>

      {/* ============ 页脚 ============ */}
      <footer className="bg-[#393e28] w-full">
        <div className="max-w-[1200px] mx-auto px-[34px] h-[50px] flex items-center justify-between text-white">
          <div className="flex items-center gap-[8px]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <path d="M12 21c0-6 0-9 0-9M12 12C12 7 7 4 3 4c0 5 4 8 9 8zM12 12c0-5 5-8 9-8 0 5-4 8-9 8z" />
            </svg>
            <span className="text-[18px] leading-none font-semibold">小棉袄</span>
          </div>
          <div className="flex items-center gap-[24px] text-[14px] tracking-[-0.35px]">
            <Link href="/profile" className="footer-link">
              老人档案
            </Link>
            <Link href="/board" className="footer-link">
              留言板
            </Link>
            <Link href="/reports" className="footer-link">
              AI 汇报
            </Link>
            <Link href="/voice_setup" className="footer-link">
              语音填表
            </Link>
          </div>
        </div>
      </footer>

      {/* ============ 本页专属样式（hero 渐变/按钮/头像浮动） ============ */}
      <style>{`
        .hero-overlay {
          background: linear-gradient(90deg, rgba(25, 40, 48, 0.55) 0%, rgba(25, 40, 48, 0.25) 45%, rgba(25, 40, 48, 0.05) 100%);
        }
        .eyebrow {
          font-size: 14px;
          line-height: 1;
          letter-spacing: -0.35px;
          text-transform: uppercase;
          color: #535557;
        }
        .nav-floating {
          transition: background-color 0.4s ease, backdrop-filter 0.4s ease, border-color 0.4s ease;
          border-bottom: 1px solid transparent;
        }
        .nav-floating.is-scrolled {
          background-color: rgba(245, 245, 238, 0.92);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid #e4e7da;
        }
        .nav-floating.is-scrolled .nav-link,
        .nav-floating.is-scrolled .nav-brand { color: #2f3136; }
        .nav-link, .nav-brand { transition: color 0.4s ease, opacity 0.3s ease; }
        .nav-link:hover { opacity: 0.7; }
        .btn-ghost {
          transition: background-color 0.3s ease, color 0.3s ease, transform 0.3s ease;
        }
        .btn-ghost:hover {
          background-color: #192830;
          color: #ffffff;
        }
        .btn-primary {
          transition: background-color 0.3s ease, transform 0.3s ease;
        }
        .btn-primary:hover {
          background-color: #2f3136;
          transform: translateY(-1px);
        }
        .btn-primary .arrow {
          display: inline-block;
          transition: transform 0.3s ease;
        }
        .btn-primary:hover .arrow {
          transform: translateX(4px);
        }
        .feature-card {
          transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .feature-card:hover {
          transform: translateY(-4px);
        }
        .feature-card .card-img {
          transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .feature-card:hover .card-img {
          transform: scale(1.05);
        }
        .avatar-float {
          animation: avatarFloat 6s ease-in-out infinite;
        }
        @keyframes avatarFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .footer-link { transition: opacity 0.3s ease; }
        .footer-link:hover { opacity: 0.6; }
      `}</style>
    </main>
  );
}

function Avatar({
  className,
  img,
  label,
  delay,
  floatDelay = 0,
}: {
  className: string;
  img: string;
  label: string;
  delay: number;
  floatDelay?: number;
}) {
  return (
    <div
      data-aos="fade-in"
      data-aos-delay={delay}
      className={`avatar-float absolute ${className} flex flex-col items-center gap-[8px]`}
      style={{ animationDelay: `${floatDelay * 0.5}s` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img}
        alt="Family member"
        className="w-[88px] h-[88px] rounded-full object-cover"
      />
      <span className="text-[14px] text-[#535557] tracking-[-0.35px]">
        {label}
      </span>
    </div>
  );
}

function FeatureCard({
  href,
  img,
  alt,
  tag,
  title,
  text,
  tint,
  delay = 0,
}: {
  href: string;
  img: string;
  alt: string;
  tag: string;
  title: string;
  text: string;
  tint: string;
  delay?: number;
}) {
  return (
    <Link
      href={href}
      data-aos="fade-up"
      data-aos-delay={delay}
      className="feature-card rounded-[6px] overflow-hidden bg-white block"
    >
      <div
        className="h-[280px] overflow-hidden"
        style={{ backgroundColor: tint }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt={alt}
          className="card-img w-full h-full object-cover opacity-90"
        />
      </div>
      <div className="p-[32px]">
        <span className="text-[14px] uppercase tracking-[-0.35px] text-[#535557]">
          {tag}
        </span>
        <h3 className="text-[#2f3136] text-[20px] tracking-[-0.32px] mt-[12px] leading-[1.2]">
          {title}
        </h3>
        <p className="text-[#535557] text-[16px] leading-[1.4] tracking-[-0.32px] mt-[12px]">
          {text}
        </p>
      </div>
    </Link>
  );
}
