// All interactive JS moved from index.html
document.querySelectorAll('.card .particles circle').forEach((c,i)=>{
  c.style.animation = `float ${4 + i}s ease-in-out infinite`;
});

// 3D parallax tilt for cards based on mouse position
const cards = Array.from(document.querySelectorAll('.card')).filter(card => !card.classList.contains('sec3-right-card'));
cards.forEach(card=>{
  card.addEventListener('mousemove', e=>{
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width/2;
    const cy = rect.height/2;
    const dx = (x - cx) / cx;
    const dy = (y - cy) / cy;
    const rotateY = dx * 6;
    const rotateX = -dy * 6;
    card.style.transform = `perspective(1000px) translateZ(0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
  });
  card.addEventListener('mouseleave', ()=>{
    card.style.transform = '';
  });
});

// ensure loaded class is applied to trigger CSS entries
window.addEventListener('load', ()=> document.body.classList.add('loaded'));

// Section 2: video card interactions + scroll animations
(function(){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        document.querySelectorAll('.sec2-title, .sec2-copy, .video-card').forEach(el=>el.classList.add('animate'));
        const vc = document.querySelector('.video-card');
        if(vc) vc.classList.add('levitate');
        io.disconnect();
      }
    })
  }, {threshold:0.22});
  const sec2 = document.querySelector('.sec2-hero');
  if(sec2) io.observe(sec2);

  const videoCard = document.querySelector('.video-card');
  if(videoCard){
    const thumb = videoCard.querySelector('.video-thumb');
    const placeholder = videoCard.querySelector('.video-frame-placeholder');
    const id = videoCard.dataset.videoId;
    function loadIframe(){
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${id}?rel=0&autoplay=1`;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.frameBorder = 0;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.borderRadius = '12px';
      placeholder.style.display = 'block';
      placeholder.innerHTML = '';
      placeholder.appendChild(iframe);
      thumb.style.transition = 'opacity .36s ease, transform .36s ease';
      thumb.style.opacity = 0; thumb.style.transform = 'scale(.98)';
      setTimeout(()=>{ thumb.style.display = 'none'; placeholder.setAttribute('aria-hidden','false') }, 360);
    }
    thumb.addEventListener('click', loadIframe);
    thumb.addEventListener('keypress', (e)=>{ if(e.key==='Enter') loadIframe() });
  }
})();

// Section 2: Typewriter loop + reveal on scroll
(function(){
  const sec = document.querySelector('.sec2-new');
  if(!sec) return;
  const left = sec.querySelector('.sec2-new-left');
  const targets = Array.from(sec.querySelectorAll('.typewriter'));
  const speed = 28;
  const pauseBetween = 500;
  const pauseEnd = 1400;
  let started = false;

  targets.forEach(el=>{
    if(!el) return;
    if(!el.dataset.orig) el.dataset.orig = el.textContent.trim();
    el.textContent = '';
  });

  function typeLine(el, text){
    return new Promise(resolve=>{
      el.textContent = '';
      let i = 0;
      const t = setInterval(()=>{
        el.textContent += text.charAt(i++);
        if(i > text.length - 1){
          clearInterval(t);
          resolve();
        }
      }, speed);
    });
  }

  async function loopTyping(){
    while(true){
      for(const el of targets){
        if(!el) continue;
        await typeLine(el, el.dataset.orig || '');
        await new Promise(r=>setTimeout(r, pauseBetween));
      }
      await new Promise(r=>setTimeout(r, pauseEnd));
      targets.forEach(el=>{ if(el) el.textContent = ''; });
      await new Promise(r=>setTimeout(r, 300));
    }
  }

  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting && !started){
        started = true;
        sec.classList.add('levitate', 'scanner');
        if(left) left.classList.add('animate');
        if(window.innerWidth <= 600){
          sec.classList.add('mobile-fx');
          sec.querySelector('.sec2-new-title')?.classList.add('animate-3d');
        }
        loopTyping();
      }
    });
  }, {threshold:0.2});

  io.observe(sec);
})();

// Particles for sec2-new
(function(){
  const canvas = document.querySelector('.sec2-particles');
  const sec = document.querySelector('.sec2-new');
  if(!canvas || !sec) return;
  const ctx = canvas.getContext('2d');
  let w, h, dots = [];
  let particlesStarted = false;
  const DPR = window.devicePixelRatio || 1;
  const mouse = { x: null, y: null, active: false };

  // Cursor interaction (desktop pointer)
  sec.addEventListener('pointermove', (e)=>{
    if(e.pointerType !== 'mouse') return;
    const rect = sec.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * DPR;
    mouse.y = (e.clientY - rect.top) * DPR;
    mouse.active = true;
  });
  sec.addEventListener('pointerleave', ()=>{ mouse.active = false; });

  function resize(){
    w = canvas.width = sec.clientWidth * DPR;
    h = canvas.height = sec.clientHeight * DPR;
    canvas.style.width = sec.clientWidth + 'px';
    canvas.style.height = sec.clientHeight + 'px';
    dots = [];
    const estimated = Math.round((w*h)/(1200*DPR));
    const count = Math.min(estimated, 120);
    for(let i=0;i<count;i++) dots.push(randomDot());
  }
  function randomDot(){
    return {
      x: Math.random()*w,
      y: Math.random()*h,
      r: (1+Math.random()*2)*DPR,
      vx: (Math.random()-0.5)*0.3*DPR,
      vy: (Math.random()-0.5)*0.3*DPR,
      alpha: 0.4+Math.random()*0.6
    }
  }
  let raf;
  function tick(){
    ctx.clearRect(0,0,w,h);
    for(const d of dots){
      d.x += d.vx; d.y += d.vy;
      if(d.x<0) d.x = w; if(d.x> w) d.x = 0;
      if(d.y<0) d.y = h; if(d.y> h) d.y = 0;
      ctx.beginPath();
      ctx.fillStyle = `rgba(107,31,181,${d.alpha})`;
      ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
      ctx.fill();
    }
    for(let i=0;i<dots.length;i++){
      for(let j=i+1;j<dots.length;j++){
        const a=dots[i], b=dots[j];
        const dx=a.x-b.x, dy=a.y-b.y; const dist=dx*dx+dy*dy;
        if(dist < (160*DPR)*(160*DPR)){
          ctx.beginPath(); ctx.strokeStyle = `rgba(107,31,181,${0.06})`; ctx.lineWidth=1*DPR;
          ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }
  window.addEventListener('resize', ()=>{ cancelAnimationFrame(raf); resize(); tick(); });
  const o = new IntersectionObserver((es)=>{
    es.forEach(e=>{
      if(e.isIntersecting && !particlesStarted){ particlesStarted = true; resize(); tick(); o.disconnect(); }
    })
  }, {threshold:0.1});
  o.observe(sec);
})();

// Section 3: play video into placeholder
(function(){
  const thumb = document.querySelector('.sec3-video-thumb');
  const placeholder = document.querySelector('.sec3-video-placeholder');
  if(!thumb || !placeholder) return;
  const id = thumb.dataset.videoId;

  function load(){
    const iframe = document.createElement('iframe');
    // Sin autoplay para que en móvil se muestren los controles nativos y se pueda pausar
    iframe.src = `https://www.youtube.com/embed/${id}?rel=0&autoplay=0&controls=1&modestbranding=1&playsinline=1`;
    iframe.frameBorder = 0;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allowfullscreen','');
    iframe.style.width = '100%'; iframe.style.height = '100%';
    placeholder.style.display = 'block'; placeholder.innerHTML=''; placeholder.appendChild(iframe);
    thumb.style.transition = 'opacity .36s ease'; thumb.style.opacity = 0; setTimeout(()=> thumb.style.display='none',360);
  }
  thumb.addEventListener('click', load);
  thumb.addEventListener('keypress', (e)=>{ if(e.key==='Enter') load() });
})();

// GSAP ScrollTrigger: pin + overlap sec2-new / sec3-new
(function(){
  if(typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({
    ignoreMobileResize: true,
    autoRefreshEvents: "visibilitychange,DOMContentLoaded,load"
  });

  ScrollTrigger.matchMedia({
    "(min-width: 900px)": function(){
      // Desktop: disabled to remove pin/overlap scroll behavior.
      return;
    },

    "(max-width: 899px)": function(){
      const sec2 = document.querySelector('.sec2-new');
      if(!sec2) return;

      const left = sec2.querySelector('.sec2-new-left');
      // Mobile: no heavy pin/scrub transition to sec3.
      if(left){
        gsap.to(left, {
          y: -10,
          opacity: 0.85,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sec2,
            start: "top 80%",
            end: "top 55%",
            scrub: false,
            toggleActions: "play none none reverse"
          }
        });
      }
    },

    "all": function(){
      const sec3 = document.querySelector('.sec3-new');
      if(!sec3) return;
      const isMobile = window.matchMedia("(max-width: 899px)").matches;
      const right = sec3.querySelector('.sec3-right');
      const headWrapper = sec3.querySelector('.sec3-head-wrapper');
      const thumb = sec3.querySelector('.sec3-video-thumb');

      // Mobile: lightweight one-shot reveal (no scrub/pin), more reliable.
      if(isMobile){
        const mobileItems = [headWrapper, right, thumb].filter(Boolean);
        if(mobileItems.length){
          gsap.from(mobileItems, {
            y: 18,
            opacity: 0,
            duration: 0.48,
            stagger: 0.1,
            ease: "power2.out",
            immediateRender: false,
            scrollTrigger:{
              trigger: sec3,
              start: "top 88%",
              toggleActions: "play none none none",
              once: true
            }
          });
        }
        return;
      }

      // Desktop sec3 scroll effect disabled by request.
      return;
    }
  });
})();

// Section 3: one-shot reveal on viewport (logo/tagline/card)
(function(){
  const sec3 = document.querySelector('.sec3-new');
  if(!sec3) return;

  if('IntersectionObserver' in window){
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach((entry)=>{
        if(entry.isIntersecting){
          sec3.classList.add('sec3-visible');
          obs.disconnect();
        }
      });
    }, { threshold: 0.22 });
    obs.observe(sec3);
  } else {
    sec3.classList.add('sec3-visible');
  }
})();

// Section 6 title: reveal on viewport
(function(){
  const sec6 = document.querySelector('.iqx-cards');
  if(!sec6) return;

  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach((entry)=>{
        if(entry.isIntersecting){
          sec6.classList.add('iqx-title-visible');
          io.disconnect();
        }
      });
    }, { threshold: 0.2 });
    io.observe(sec6);
  } else {
    sec6.classList.add('iqx-title-visible');
  }
})();

// Section 7 title: reveal on viewport
(function(){
  const sec7 = document.querySelector('.sec7-entrena');
  if(!sec7) return;

  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach((entry)=>{
        if(entry.isIntersecting){
          sec7.classList.add('sec7-title-visible');
          io.disconnect();
        }
      });
    }, { threshold: 0.2 });
    io.observe(sec7);
  } else {
    sec7.classList.add('sec7-title-visible');
  }
})();

// Segments slider - Autoplay only when visible in viewport
(function(){
  var track = document.querySelector('.segments-track');
  var segments = document.querySelectorAll('.segment');
  var dotsWrap = document.querySelector('.segments-dots');
  var segmentsSection = document.querySelector('.segments');
  if(!track || !segments.length || !segmentsSection) return;

  // Only on mobile
  var isMobile = window.innerWidth <= 900;
  var sectionVisible = false;
  var segmentVideos = [];
  var autoSlideTimer = null;
  var autoSlideDelay = 2200;
  var autoDirection = 1;

  function toWebmPath(imgSrc){
    return imgSrc.replace(/\.(jpg|jpeg|png|webp)(\?.*)?$/i, '.webm$2');
  }

  function stopAllVideos(exceptIndex){
    segmentVideos.forEach(function(item, i){
      if(!item || !item.video) return;
      if(i !== exceptIndex){
        item.photo.classList.remove('is-video-active');
        item.video.pause();
        try { item.video.currentTime = 0; } catch(e) {}
      }
    });
  }

  function playSegmentVideo(index){
    var item = segmentVideos[index];
    if(!item || !item.video) return;
    stopAllVideos(index);
    var p = item.video.play();
    if(p && typeof p.then === 'function'){
      p.then(function(){
        item.photo.classList.add('is-video-active');
      }).catch(function(){
        item.photo.classList.remove('is-video-active');
      });
    } else {
      item.photo.classList.add('is-video-active');
    }
  }

  function playRandomSegment(){
    if(!segments.length) return;
    var idx = Math.floor(Math.random() * segments.length);
    currentIndex = idx;
    updateDots();
    playSegmentVideo(idx);
  }

  function stopMobileAutoSlide(){
    if(autoSlideTimer){
      clearInterval(autoSlideTimer);
      autoSlideTimer = null;
    }
  }

  function startMobileAutoSlide(){
    if(!isMobile || !sectionVisible || segments.length < 2) return;
    stopMobileAutoSlide();
    autoSlideTimer = setInterval(function(){
      if(currentIndex >= segments.length - 1){
        autoDirection = -1;
      } else if(currentIndex <= 0){
        autoDirection = 1;
      }
      currentIndex += autoDirection;
      segments[currentIndex].scrollIntoView({behavior:'smooth', inline:'center'});
      updateDots();
      setTimeout(function(){
        if(isMobile && sectionVisible){
          playSegmentVideo(currentIndex);
        }
      }, 220);
    }, autoSlideDelay);
  }

  segments.forEach(function(seg){
    var photo = seg.querySelector('.photo');
    var img = photo ? photo.querySelector('img') : null;
    if(!photo || !img) return;

    var video = document.createElement('video');
    video.src = toWebmPath(img.getAttribute('src') || '');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    photo.appendChild(video);
    segmentVideos.push({ photo: photo, video: video });
  });
  
  // Create dots
  var dots = [];
  var currentIndex = 0;
  
  for(var i=0; i<segments.length; i++){
    var btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Segmento ' + (i+1));
    if(i===0) btn.classList.add('active');
    dotsWrap.appendChild(btn);
    dots.push(btn);
    btn.onclick = (function(idx){
      return function(){ 
        currentIndex = idx;
        segments[idx].scrollIntoView({behavior:'smooth', inline:'center'}); 
        updateDots();
      };
    })(i);
  }

  function updateDots(){
    dots.forEach(function(d, i){
      d.classList.toggle('active', i === currentIndex);
    });
    segments.forEach(function(seg, i){
      seg.classList.toggle('active', i === currentIndex);
    });
  }

  // Update current index on scroll
  var scrollObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        var idx = Array.from(segments).indexOf(entry.target);
        if(idx !== -1){
          currentIndex = idx;
          updateDots();
          if(isMobile && sectionVisible){
            playSegmentVideo(idx);
          }
        }
      }
    });
  }, {threshold: 0.6, root: track});

  segments.forEach(function(seg){
    scrollObserver.observe(seg);
  });

  // IntersectionObserver to detect when section is visible
  var sectionObserver = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      if(entry.isIntersecting){
        sectionVisible = true;
        if(isMobile){
          playSegmentVideo(currentIndex);
          startMobileAutoSlide();
        } else {
          stopMobileAutoSlide();
          playRandomSegment();
        }
      } else {
        sectionVisible = false;
        stopMobileAutoSlide();
        stopAllVideos(-1);
      }
    });
  }, {threshold: 0.3}); // Start when 30% of section is visible

  sectionObserver.observe(segmentsSection);

  // Desktop hover: play only hovered column
  segments.forEach(function(seg, i){
    seg.addEventListener('mouseenter', function(){
      if(isMobile || !sectionVisible) return;
      currentIndex = i;
      updateDots();
      playSegmentVideo(i);
    });
  });

  // On mobile, pause autoplay while user drags/swipes manually.
  track.addEventListener('touchstart', function(){
    if(!isMobile) return;
    stopMobileAutoSlide();
  }, {passive: true});

  track.addEventListener('touchend', function(){
    if(!isMobile || !sectionVisible) return;
    setTimeout(function(){
      if(isMobile && sectionVisible){
        startMobileAutoSlide();
      }
    }, 1500);
  }, {passive: true});

  // Handle resize
  window.addEventListener('resize', function(){
    isMobile = window.innerWidth <= 900;
    if(sectionVisible){
      if(isMobile){
        playSegmentVideo(currentIndex);
        startMobileAutoSlide();
      } else {
        stopMobileAutoSlide();
        playRandomSegment();
      }
    } else {
      stopMobileAutoSlide();
    }
  });

  // Arrow buttons
  var prevBtn = document.querySelector('.segments-arrow.prev');
  var nextBtn = document.querySelector('.segments-arrow.next');
  
  if(prevBtn && nextBtn){
    prevBtn.addEventListener('click', function(){
      stopMobileAutoSlide();
      currentIndex = (currentIndex > 0) ? currentIndex - 1 : segments.length - 1;
      segments[currentIndex].scrollIntoView({behavior:'smooth', inline:'center'});
      if(sectionVisible){
        setTimeout(function(){ playSegmentVideo(currentIndex); }, 220);
        setTimeout(function(){
          if(isMobile && sectionVisible){
            startMobileAutoSlide();
          }
        }, 1500);
      }
    });
    
    nextBtn.addEventListener('click', function(){
      stopMobileAutoSlide();
      currentIndex = (currentIndex + 1) % segments.length;
      segments[currentIndex].scrollIntoView({behavior:'smooth', inline:'center'});
      if(sectionVisible){
        setTimeout(function(){ playSegmentVideo(currentIndex); }, 220);
        setTimeout(function(){
          if(isMobile && sectionVisible){
            startMobileAutoSlide();
          }
        }, 1500);
      }
    });
  }

  // Initial check
  setTimeout(function(){
    var rect = segmentsSection.getBoundingClientRect();
    var isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if(isVisible){
      sectionVisible = true;
      if(isMobile){
        playSegmentVideo(currentIndex);
        startMobileAutoSlide();
      } else {
        stopMobileAutoSlide();
        playRandomSegment();
      }
    }
  }, 500);

})();

// Reveal cards on scroll
(function(){
  const cards = Array.from(document.querySelectorAll('.card')).filter(card => !card.classList.contains('sec3-right-card'));
  if(cards.length){
    const cardObserver = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting) entry.target.classList.add('animate');
      });
    }, {threshold: 0.18});
    cards.forEach(c=>cardObserver.observe(c));
  }
})();

// Testimonials reveal
(function(){
  var section = document.querySelector('.iqx-testimonials');
  if(!section) return;
  var track = section.querySelector('.iqx-testimonials-grid');
  var cards = Array.from(section.querySelectorAll('.iqx-t-card'));
  if(!cards.length) return;
  var mobileQuery = window.matchMedia('(max-width:640px)');
  var autoplayTimer = null;
  var resumeTimer = null;
  var scrollEndTimer = null;
  var sectionVisible = false;
  var currentMobileIndex = 0;
  var autoScrollActive = false;

  function stopMobileAutoplay(){
    if(autoplayTimer){
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
    if(resumeTimer){
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function getCards(){
    return Array.from(section.querySelectorAll('.iqx-t-card'));
  }

  function updateCurrentIndexFromScroll(){
    if(!track) return;
    var liveCards = getCards();
    if(!liveCards.length) return;
    var center = track.scrollLeft + (track.clientWidth / 2);
    var bestIndex = 0;
    var bestDistance = Number.POSITIVE_INFINITY;
    liveCards.forEach(function(card, idx){
      var cardCenter = card.offsetLeft + (card.offsetWidth / 2);
      var dist = Math.abs(center - cardCenter);
      if(dist < bestDistance){
        bestDistance = dist;
        bestIndex = idx;
      }
    });
    currentMobileIndex = bestIndex;
  }

  function goToCard(index, smooth, fromAutoplay){
    if(!track || !mobileQuery.matches) return;
    var liveCards = getCards();
    if(!liveCards.length) return;
    var len = liveCards.length;
    var nextIndex = ((index % len) + len) % len;
    currentMobileIndex = nextIndex;
    var card = liveCards[nextIndex];
    var left = card.offsetLeft - ((track.clientWidth - card.offsetWidth) / 2);
    if(fromAutoplay) autoScrollActive = true;
    track.scrollTo({
      left: Math.max(0, left),
      behavior: smooth ? 'smooth' : 'auto'
    });
    if(fromAutoplay){
      setTimeout(function(){
        autoScrollActive = false;
      }, 760);
    }
  }

  function startMobileAutoplay(){
    if(!track || !mobileQuery.matches || !sectionVisible) return;
    var liveCards = getCards();
    if(liveCards.length < 2) return;
    stopMobileAutoplay();
    autoplayTimer = setInterval(function(){
      var next = currentMobileIndex + 1;
      if(next >= liveCards.length) next = 0;
      goToCard(next, true, true);
    }, 3200);
  }

  function pauseMobileAutoplayTemporarily(delayMs){
    if(!mobileQuery.matches) return;
    stopMobileAutoplay();
    resumeTimer = setTimeout(function(){
      if(sectionVisible && mobileQuery.matches){
        startMobileAutoplay();
      }
    }, delayMs || 2200);
  }

  if('IntersectionObserver' in window){
    var observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          section.classList.add('is-visible');
          cards.forEach(function(card, index){
            setTimeout(function(){
              card.classList.add('is-visible');
              setTimeout(function(){
                card.classList.add('is-looping');
              }, 780);
            }, 420 + (index * 150));
          });
          observer.disconnect();
        }
      });
    }, { threshold: 0.25 });
    observer.observe(section);
  } else {
    section.classList.add('is-visible');
    cards.forEach(function(card){
      card.classList.add('is-visible');
      card.classList.add('is-looping');
    });
  }

  if(track){
    track.addEventListener('touchstart', function(){
      pauseMobileAutoplayTemporarily(2600);
    }, { passive: true });

    track.addEventListener('pointerdown', function(){
      pauseMobileAutoplayTemporarily(2600);
    }, { passive: true });

    track.addEventListener('wheel', function(){
      pauseMobileAutoplayTemporarily(2400);
    }, { passive: true });

    track.addEventListener('scroll', function(){
      if(scrollEndTimer) clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(updateCurrentIndexFromScroll, 90);
      if(!autoScrollActive){
        pauseMobileAutoplayTemporarily(2200);
      }
    }, { passive: true });
  }

  if('IntersectionObserver' in window){
    var autoplayObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        sectionVisible = entry.isIntersecting;
        if(sectionVisible){
          startMobileAutoplay();
        } else {
          stopMobileAutoplay();
        }
      });
    }, { threshold: 0.35 });
    autoplayObserver.observe(section);
  } else {
    sectionVisible = true;
    startMobileAutoplay();
  }

  function handleViewportChange(){
    updateCurrentIndexFromScroll();
    if(mobileQuery.matches){
      if(sectionVisible) startMobileAutoplay();
    } else {
      stopMobileAutoplay();
    }
  }

  if(typeof mobileQuery.addEventListener === 'function'){
    mobileQuery.addEventListener('change', handleViewportChange);
  } else if(typeof mobileQuery.addListener === 'function'){
    mobileQuery.addListener(handleViewportChange);
  }

  setTimeout(function(){
    updateCurrentIndexFromScroll();
    if(mobileQuery.matches && sectionVisible){
      goToCard(currentMobileIndex, false, false);
    }
  }, 120);
})();

// Section 5: Family Solution - reveal on scroll
(function(){
  const sec5 = document.querySelector('.sec5-family');
  if(!sec5) return;
  
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        sec5.classList.add('animate');
        sec5.classList.add('is-inview');
        // Optionally disconnect after first animation
        // observer.disconnect();
      }
    });
  }, {threshold: 0.25});
  
  observer.observe(sec5);
})();

// Section 7: Entrena tu Mente - Interactive
(function initSec7(){
  const hub = document.getElementById('sec7Hub');
  const grid = document.getElementById('sec7Grid');
  const overlay = document.getElementById('sec7Overlay');
  const modal = document.getElementById('sec7Modal');
  if(!hub || !grid) return;

  let activated = false;

  const ejercicios = {
    1: {icon: 'eye', titulo: 'RASTREO VISUAL PROGRESIVO', desc: 'Sigue el flujo de palabras en distintas formas y rutas. Si recuerdas la última palabra correctamente, el sistema aumentará la velocidad automáticamente.', color: 'linear-gradient(135deg,#692ac6,#8a5ad9)', tags: ['Seguimiento', 'Velocidad'], link: 'visual.html'},
    2: {icon: 'aperture', titulo: 'RADAR PERIFÉRICO', desc: 'Entrena a tu cerebro para detectar información en los extremos sin mover la vista del punto central.', color: 'linear-gradient(135deg,#c77dff,#9b59b6)', tags: ['Expansión', 'Detección'], link: 'periferico.html'},
    3: {icon: 'flash', titulo: 'DECODIFICACIÓN DINÁMICA', desc: 'Alterna entre Golpe de Vista y Desplazamiento para lograr una lectura fotográfica y continua.', color: 'linear-gradient(135deg,#f39c12,#e67e22)', tags: ['Lectura rápida', 'Memoria'], link: 'taquistoscopia.html'},
    4: {icon: 'search', titulo: 'ENFOQUE LÁSER', desc: 'Ignora el "ruido visual" y localiza el dato exacto dentro de la matriz en tiempo récord.', color: 'linear-gradient(135deg,#4a9a9e,#5eb4b9)', tags: ['Enfoque', 'Concentración'], link: 'atencionselectiva.html'}
  };

  function revealSec7Cards(){
    if(activated) return;
    hub.classList.add('activated');
    hub.style.pointerEvents = 'none';
    hub.style.cursor = 'default';
    activated = true;
    grid.style.display = 'grid';
    setTimeout(function(){
      grid.classList.add('visible');
      grid.querySelectorAll('.sec7-card').forEach(function(card, i){
        setTimeout(function(){
          card.classList.add('visible');
        }, i * 80);
      });
    }, 30);
  }

  // Keep global handler for inline onclick, but interaction is disabled by request.
  window.sec7Activar = function(){};

  const sec7Section = document.querySelector('.sec7-entrena');
  if(sec7Section && 'IntersectionObserver' in window){
    const sec7Observer = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting && entry.intersectionRatio > 0.22){
          revealSec7Cards();
          sec7Observer.disconnect();
        }
      });
    }, { threshold: [0.12, 0.22, 0.4] });
    sec7Observer.observe(sec7Section);
  } else {
    revealSec7Cards();
  }

  // Abrir modal al hacer click en una card
  window.sec7Abrir = function(id){
    if(!activated) return;
    var ej = ejercicios[id];
    if(!ej) return;
    var iconEl = document.getElementById('sec7ModalIcon');
    iconEl.innerHTML = '<video src="https://iqexponencial.app/api/images/1dfabaf4-1590-4a3f-9312-a3cd1e1238d1" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:contain;border-radius:14px;"></video>';
    iconEl.style.background = 'transparent';
    document.getElementById('sec7ModalTitulo').innerText = ej.titulo;
    document.getElementById('sec7ModalDesc').innerText = ej.desc;
    document.getElementById('sec7ModalBtn').href = ej.link;
    document.getElementById('sec7ModalTags').innerHTML = ej.tags.map(function(t){
      return '<span>' + t + '</span>';
    }).join('');
    overlay.classList.add('active');
    modal.classList.add('active');
  };

  // Cerrar modal
  window.sec7Cerrar = function(){
    modal.classList.remove('active');
    overlay.classList.remove('active');
  };

  // Cerrar con Escape
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') window.sec7Cerrar();
  });
})();

