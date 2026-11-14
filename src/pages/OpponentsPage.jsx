import PageNotice from '../components/PageNotice.jsx'
import PlayerCard from '../components/PlayerCard.jsx'
import { errorText } from '../helpers/format.js'
import { listPlayers } from '../helpers/players.js'
import { useLoad } from '../helpers/useLoad.js'
import './OpponentsPage.css'

function OpponentsPage() {
  const { data: players, error, loading } = useLoad(listPlayers, 'players')
  const others = players?.filter((profile) => !profile.is_me) ?? []

  return (
    <div className="opponents-page">
      <header className="opponents-header">
        <div className="opponents-eyebrow">OPPONENTS</div>
        <h1 className="opponents-title">Player profiles</h1>
        <p className="opponents-text">
          Everyone you have shared a table with: how often they bluff, how their tells have shown up, and how readable
          they have been.
        </p>
      </header>

      {loading && <PageNotice kind="loading" />}
      {error && <PageNotice kind="error" title="Couldn’t load profiles" text={errorText(error)} />}

      {players && (
        <div className="opponents-grid">
          {players.map((profile, index) => (
            <PlayerCard key={profile.player.id} profile={profile} index={index} />
          ))}
        </div>
      )}
      {players && others.length === 0 && (
        <PageNotice
          kind="empty"
          title="No opponents yet"
          text="Play a live game and the people you sit with will appear here."
          action={{ to: '/play', label: 'Play live' }}
        />
      )}
    </div>
  )
}

export default OpponentsPage
