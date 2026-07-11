import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowRight, CalendarDays, Check, MessageCircle, Moon, RefreshCw, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './PitchDeck.module.css'

const chapters = ['Hook', 'Problem', 'Connect', 'Plan', 'Replan', 'Vachan', 'Future', 'Demo']
const blocks = [
  [1, 1, 2, 'School', 'fixed'], [2, 1, 2, 'School', 'fixed'], [3, 1, 2, 'School', 'fixed'],
  [4, 1, 2, 'School', 'fixed'], [5, 1, 2, 'School', 'fixed'], [1, 4, 1, 'Chem lab report', 'work'],
  [2, 5, 1, 'Essay draft', 'moved'], [3, 4, 1, 'Calculus set', 'work'], [4, 4, 1, 'Dentist · 3 PM', 'new'],
  [4, 6, 1, 'Essay draft', 'moved'], [5, 5, 1, 'Weekly review', 'work'], [6, 4, 2, 'One-day buffer', 'buffer'],
] as const

function Week({ compact = false }: { compact?: boolean }) {
  return <div className={`${styles.week} ${compact ? styles.weekCompact : ''}`} aria-label="A weekly schedule that replans around a new appointment">
    <div className={styles.weekTop}><strong>This week</strong><span><i /> Replanned automatically</span></div>
    <div className={styles.dayLabels}>{['Mon 10', 'Tue 11', 'Wed 12', 'Thu 13', 'Fri 14', 'Sat 15'].map(day => <span key={day}>{day}</span>)}</div>
    <div className={styles.calendarGrid}>{blocks.map(([day,row,span,label,kind],index) => <div key={`${label}-${index}`} className={`${styles.calendarBlock} ${styles[`block_${kind}`]}`} style={{'--day':day,'--row':row,'--span':span} as CSSProperties}>{kind === 'moved' && <ArrowRight size={12}/>}<span>{label}</span></div>)}</div>
    <div className={styles.weekFooter}><span><Moon size={14}/> Sleep protected</span><span><ShieldCheck size={14}/> School protected</span><span><Check size={14}/> Due one day early</span></div>
  </div>
}

export default function PitchDeck() {
  const deckRef = useRef<HTMLElement>(null)
  const [active,setActive] = useState(0)
  const goTo = (index:number) => deckRef.current?.querySelector<HTMLElement>(`[data-slide="${index}"]`)?.scrollIntoView()

  useEffect(() => {
    const deck=deckRef.current; if(!deck) return
    const slides=Array.from(deck.querySelectorAll<HTMLElement>('[data-slide]'))
    const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)setActive(Number((visible.target as HTMLElement).dataset.slide))},{root:deck,threshold:[.5,.75]})
    slides.forEach(slide=>observer.observe(slide)); return()=>observer.disconnect()
  },[])

  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if(!['ArrowDown','ArrowRight','PageDown',' ','ArrowUp','ArrowLeft','PageUp'].includes(event.key))return;event.preventDefault();const direction=['ArrowUp','ArrowLeft','PageUp'].includes(event.key)?-1:1;goTo(Math.max(0,Math.min(chapters.length-1,active+direction)))};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[active])

  return <div className={styles.pitchShell}>
    <header className={styles.header}><button className={styles.brand} onClick={()=>goTo(0)} aria-label="Return to opening slide"><span className={styles.brandMark}>1</span>Priority:One</button><div className={styles.presenterHint}><span>Use arrows to present</span><kbd>→</kbd></div></header>
    <main className={styles.deck} ref={deckRef}>
      <section className={`${styles.slide} ${styles.hero}`} data-slide="0" aria-labelledby="hook-title"><div className={styles.heroCopy}><p className={styles.context}>Life moved first.</p><h1 id="hook-title">Your calendar just changed. <em>Your plan already did.</em></h1><p className={styles.lede}>Priority:One rebuilds the week around real life—without sacrificing sleep, school, or the one-day buffer.</p><button className={styles.continue} onClick={()=>goTo(1)}>See why it matters <ArrowDown size={18}/></button></div><div className={styles.heroArtifact}><div className={styles.changeNotice}><RefreshCw size={16}/><span><strong>Calendar change detected</strong>Dentist added Thursday at 3 PM</span><b>Resolved</b></div><Week/></div></section>
      <section className={`${styles.slide} ${styles.problem}`} data-slide="1" aria-labelledby="problem-title"><div><h2 id="problem-title">Deadlines aren’t a plan.</h2><p>Classroom tells students what is due. It never tells them when to begin, what fits tonight, or what moves when life gets in the way.</p></div><div className={styles.deadlineStack} aria-label="A pile of disconnected assignment deadlines">{['Essay · Friday','Lab report · Tomorrow','Problem set · 11:59 PM','Reading quiz · Thursday','Group project · Sunday'].map((item,i)=><span style={{'--i':i} as CSSProperties} key={item}>{item}</span>)}</div><p className={styles.problemClose}>The problem isn’t effort. It’s that no tool turns deadlines into time.</p></section>
      <section className={`${styles.slide} ${styles.connect}`} data-slide="2" aria-labelledby="connect-title"><div className={styles.chapterCopy}><h2 id="connect-title">One login.<br/>The whole picture.</h2><p>Priority:One reads the systems students already trust. No second planner to maintain.</p></div><div className={styles.sourceFlow}><div><CalendarDays/><strong>Google Calendar</strong><span>Classes, practices, appointments, life</span></div><div><span className={styles.classroomIcon}>C</span><strong>Google Classroom</strong><span>Assignments, due dates, course context</span></div><ArrowRight className={styles.flowArrow}/><div className={styles.sourceResult}><span className={styles.brandMark}>1</span><strong>One living schedule</strong><span>Always current. Always realistic.</span></div></div></section>
      <section className={`${styles.slide} ${styles.plan}`} data-slide="3" aria-labelledby="plan-title"><div className={styles.chapterCopy}><h2 id="plan-title">It plans the work.<br/>Not just the due date.</h2><p>School and sleep become fixed constraints. Every assignment gets a real work block and a one-day safety margin.</p></div><Week compact/></section>
      <section className={`${styles.slide} ${styles.replan}`} data-slide="4" aria-labelledby="replan-title"><div className={styles.replanCopy}><p>Then Thursday changes.</p><h2 id="replan-title">The schedule moves.<br/>The priorities don’t.</h2></div><div className={styles.replanSequence}><div><span>3:00 PM</span><strong>Dentist appointment</strong><small>New calendar event</small></div><ArrowRight/><div><RefreshCw/><strong>7 blocks reconsidered</strong><small>Best open slots found</small></div><ArrowRight/><div><Check/><strong>0 deadlines at risk</strong><small>Sleep and school untouched</small></div></div></section>
      <section className={`${styles.slide} ${styles.vachan}`} data-slide="5" aria-labelledby="vachan-title"><div className={styles.chapterCopy}><h2 id="vachan-title">A plan for the work.<br/>A person in your corner.</h2><p>Vachan notices pressure before it becomes panic—and can adjust the real schedule from the conversation.</p></div><div className={styles.conversation}><div className={styles.vachanMessage}><span className={styles.vmark}>v</span><p>I noticed three assignments land on Friday. Want me to spread the work out?</p></div><div className={styles.studentMessage}>Yes, please. Keep Thursday lighter.</div><div className={styles.vachanMessage}><span className={styles.vmark}>v</span><p>Done. Your essay moved to Sunday, and you’re still a day ahead.</p></div><div className={styles.conversationStatus}><MessageCircle size={15}/> Schedule updated from conversation</div></div></section>
      <section className={`${styles.slide} ${styles.future}`} data-slide="6" aria-labelledby="future-title"><div className={styles.chapterCopy}><h2 id="future-title">Google Classroom is the start.</h2><p>The scheduling engine is platform-agnostic. The next step is every student, whatever system their school chose.</p></div><div className={styles.platforms}>{['Canvas','Schoology','PowerSchool','Infinite Campus'].map(name=><span key={name}>{name}</span>)}</div><p className={styles.futureLine}>One agentic planning layer across school, calendar, and life.</p></section>
      <section className={`${styles.slide} ${styles.demo}`} data-slide="7" aria-labelledby="demo-title"><div><p className={styles.context}>The plan is already moving.</p><h2 id="demo-title">Let us show you.</h2><p>From Google sign-in to a complete week—and one real-time replan.</p></div><Link className={styles.demoButton} to="/sign-in">Start the live demo <ArrowRight size={20}/></Link><p className={styles.credits}>Built with care by Tarun Devarajan &amp; Jovanny Shek</p></section>
    </main>
    <nav className={styles.chapterNav} aria-label="Pitch chapters"><span className={styles.progressText}>{String(active+1).padStart(2,'0')} / {String(chapters.length).padStart(2,'0')}</span><div className={styles.progressTrack}>{chapters.map((chapter,index)=><button key={chapter} className={index===active?styles.activeChapter:''} onClick={()=>goTo(index)} aria-label={`Go to ${chapter}`}><i/><span>{chapter}</span></button>)}</div></nav>
  </div>
}
