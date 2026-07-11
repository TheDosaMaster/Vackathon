import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, Clock3, ShieldCheck } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import Button from '../ui/Button'
import s from '../views.module.css'

export default function SignIn(){
  const [name,setName]=useState('Jordan'); const {signIn,isSignedIn}=useApp(); const nav=useNavigate()
  const go=()=>{signIn(name.trim()||'Jordan');nav('/onboarding/connect')}
  if(isSignedIn) nav('/')
  return <div className={s.centered}><div className={s.auth}>
    <section className={s.authIntro}><div className={s.logo}><span className={s.logoMark}>P:1</span>Priority:One</div><div><h1 className={s.display}>Your work, planned around your life.</h1><p style={{marginTop:18}}>A calm schedule built from your real classes, deadlines, calendar, school day, and sleep.</p></div><div className={s.promise}><div className={s.promiseItem}><CalendarCheck size={20}/>Finishes assignments one day early</div><div className={s.promiseItem}><Clock3 size={20}/>Replans when your calendar changes</div><div className={s.promiseItem}><ShieldCheck size={20}/>You stay in control of every connection</div></div></section>
    <section className={s.authForm}><div><h2 className={s.display}>Welcome in.</h2><p style={{marginTop:10}}>Connect your school day in under two minutes.</p></div><label className={s.field}>First name<input className={s.input} value={name} onChange={e=>setName(e.target.value)} /></label><Button className={s.google} onClick={go}>Continue with Google</Button><p className={s.fine}>Frontend demo: Google authorization is simulated. No account data leaves your browser.</p></section>
  </div></div>
}
