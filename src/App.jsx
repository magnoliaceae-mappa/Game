import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const pokemons = [
  { id: 1, name: "Bulbasaur", type: "Grass", hp: 45, attack: 49 },
  { id: 4, name: "Charmander", type: "Fire", hp: 39, attack: 52 },
  { id: 7, name: "Squirtle", type: "Water", hp: 44, attack: 48 },
  { id: 25, name: "Pikachu", type: "Electric", hp: 35, attack: 55 },
  { id: 6, name: "Charizard", type: "Fire", hp: 78, attack: 84 },
  { id: 9, name: "Blastoise", type: "Water", hp: 79, attack: 83 },
  { id: 3, name: "Venusaur", type: "Grass", hp: 80, attack: 82 },
  { id: 150, name: "Mewtwo", type: "Psychic", hp: 106, attack: 110 },
  { id: 39, name: "Jigglypuff", type: "Normal", hp: 115, attack: 45 },
  { id: 143, name: "Snorlax", type: "Normal", hp: 160, attack: 110 },
  { id: 94, name: "Gengar", type: "Ghost", hp: 60, attack: 65 },
  { id: 131, name: "Lapras", type: "Water", hp: 130, attack: 85 },
  { id: 133, name: "Eevee", type: "Normal", hp: 55, attack: 55 },
  { id: 149, name: "Dragonite", type: "Dragon", hp: 91, attack: 134 },
  { id: 59, name: "Arcanine", type: "Fire", hp: 90, attack: 110 },
  { id: 65, name: "Alakazam", type: "Psychic", hp: 55, attack: 50 },
  { id: 68, name: "Machamp", type: "Fighting", hp: 90, attack: 130 },
  { id: 76, name: "Golem", type: "Rock", hp: 80, attack: 120 },
  { id: 130, name: "Gyarados", type: "Water", hp: 95, attack: 125 },
  { id: 148, name: "Dragonair", type: "Dragon", hp: 61, attack: 84 },
];

const spriteUrl = (id) => `${import.meta.env.BASE_URL}images/${id}.png`;

function shuffleCards() {
  const cards = pokemons.flatMap((pokemon) => [
    { ...pokemon, cardKey: `${pokemon.id}-a` },
    { ...pokemon, cardKey: `${pokemon.id}-b` },
  ]);
  return d3.shuffle(cards);
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function ProgressBar({ matchedCount, total }) {
  const svgRef = useRef(null);
  const ratio = matchedCount / total;

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("viewBox", "0 0 300 17").attr("preserveAspectRatio", "none");
    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 3)
      .attr("width", 300)
      .attr("height", 11)
      .attr("rx", 5.5)
      .attr("fill", "#34445b");

    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 3)
      .attr("width", 0)
      .attr("height", 11)
      .attr("rx", 5.5)
      .attr("fill", "#82e0b0")
      .transition()
      .duration(350)
      .attr("width", 300 * ratio);

    return () => svg.selectAll("*").interrupt();
  }, [ratio]);

  return (
    <div
      className="progress-viz"
      role="img"
      aria-label={`Collection progress: ${matchedCount} of ${total} pairs matched`}
    >
      <svg ref={svgRef} />
    </div>
  );
}

function PokemonSprite({ pokemon, imageState, className = "" }) {
  const failed = imageState === "error";
  return failed ? (
    <span
      className={`sprite-fallback ${className}`}
      role="img"
      aria-label={`${pokemon.name} image unavailable`}
    >
      {pokemon.type === "Fire"
        ? "🔥"
        : pokemon.type === "Water"
          ? "💧"
          : pokemon.type === "Grass"
            ? "🌿"
            : "⭐"}
    </span>
  ) : (
    <img className={className} src={spriteUrl(pokemon.id)} alt="" />
  );
}

function PokemonCard({
  pokemon,
  flipped,
  matched,
  onClick,
  imageState,
  disabled,
}) {
  return (
    <button
      type="button"
      className={`pokemon-card${flipped ? " is-flipped" : ""}${matched ? " is-matched" : ""}`}
      onClick={onClick}
      disabled={matched || disabled}
      aria-label={
        flipped || matched
          ? `${pokemon.name}, ${pokemon.type} type, HP ${pokemon.hp}`
          : `Face-down Pokémon card. Reveal card.`
      }
      aria-pressed={flipped || matched}
    >
      <span className="card-inner">
        <span className="card-face card-back" aria-hidden="true">
          <span className="card-pattern">✦</span>
        </span>
        <span className="card-face card-front">
          <PokemonSprite pokemon={pokemon} imageState={imageState} />
          <span className="card-name">{pokemon.name}</span>
          <span className="card-type">
            {pokemon.type} · HP {pokemon.hp}
          </span>
        </span>
      </span>
    </button>
  );
}

export default function App() {
  const [cards, setCards] = useState(shuffleCards);
  const [selected, setSelected] = useState([]);
  const [matchedIds, setMatchedIds] = useState(() => new Set());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [message, setMessage] = useState(
    "Ready when you are. Find your first pair!",
  );
  const [showWin, setShowWin] = useState(false);
  const [spriteStates, setSpriteStates] = useState({});
  const [imageProgress, setImageProgress] = useState({
    loaded: 0,
    failed: 0,
    total: pokemons.length,
  });
  const [imagesReady, setImagesReady] = useState(false);
  const mismatchTimer = useRef(null);

  // Request every sprite as soon as the app starts, rather than waiting for a card flip.
  useEffect(() => {
    let cancelled = false;
    let completed = 0;
    let failed = 0;
    const total = pokemons.length;
    setImagesReady(false);
    setImageProgress({ loaded: 0, failed: 0, total });

    const requests = pokemons.map(
      (pokemon) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve({ id: pokemon.id, status: "loaded" });
          image.onerror = () => resolve({ id: pokemon.id, status: "error" });
          image.src = spriteUrl(pokemon.id);
        }),
    );

    requests.forEach((request) =>
      request.then((result) => {
        if (cancelled) return;
        completed += 1;
        if (result.status === "error") failed += 1;
        setSpriteStates((previous) => ({
          ...previous,
          [result.id]: result.status,
        }));
        setImageProgress({ loaded: completed, failed, total });
        if (completed === total) setImagesReady(true);
      }),
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const matchedCount = matchedIds.size;
  const totalPairs = pokemons.length;
  const matchedPokemon = useMemo(
    () => pokemons.filter((pokemon) => matchedIds.has(pokemon.id)),
    [matchedIds],
  );

  useEffect(() => {
    if (!started || showWin) return undefined;
    const timer = window.setInterval(
      () => setSeconds((value) => value + 1),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [started, showWin]);

  useEffect(
    () => () => {
      if (mismatchTimer.current) window.clearTimeout(mismatchTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (matchedCount === totalPairs) {
      setShowWin(true);
      setMessage("Amazing work! Every Pokémon pair is in your stack!");
    }
  }, [matchedCount, totalPairs]);

  const resetGame = useCallback(() => {
    if (mismatchTimer.current) window.clearTimeout(mismatchTimer.current);
    mismatchTimer.current = null;
    setCards(shuffleCards());
    setSelected([]);
    setMatchedIds(new Set());
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setLocked(false);
    setShowWin(false);
    setMessage("Ready when you are. Find your first pair!");
  }, []);

  const handleCardClick = (card) => {
    if (
      !imagesReady ||
      locked ||
      selected.some((item) => item.cardKey === card.cardKey) ||
      matchedIds.has(card.id) ||
      selected.length >= 2
    )
      return;

    setStarted(true);
    const nextSelected = [...selected, card];
    setSelected(nextSelected);

    if (nextSelected.length === 2) {
      setMoves((value) => value + 1);
      const [first, second] = nextSelected;

      if (first.id === second.id) {
        setMatchedIds((previous) => {
          const next = new Set(previous);
          next.add(first.id);
          return next;
        });
        setSelected([]);
        setMessage(`Nice match! You found ${first.name}.`);
      } else {
        setLocked(true);
        setMessage("Not a match. Take another look — try again!");
        mismatchTimer.current = window.setTimeout(() => {
          setSelected([]);
          setLocked(false);
          mismatchTimer.current = null;
          setMessage("Cards are flipped back over! Try another pair!");
        }, 2000);
      }
    }
  };

  const isFlipped = (card) =>
    selected.some((selectedCard) => selectedCard.cardKey === card.cardKey) ||
    matchedIds.has(card.id);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Pokémon Memory Match home">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>
          <span>
            POKÉ<span className="brand-accent">MATCH</span>
          </span>
        </a>
        <button className="reset-button" onClick={resetGame} type="button">
          <span aria-hidden="true">↻</span> New game
        </button>
      </header>

      <section className="intro" aria-labelledby="pageTitle">
        <p className="eyebrow">THE MEMORY CHALLENGE</p>
        <h1 id="pageTitle">
          Gotta match <span>’em all.</span>
        </h1>
        <p className="subtitle">
          Find the matching Pokémon pairs. Flip two cards, remember what you
          see, and build your collection.
        </p>
      </section>

      <section className="game-dashboard" aria-label="Game statistics">
        <div className="stat-card">
          <span className="stat-label">MATCHED</span>
          <strong>
            {matchedCount} <small>/ {totalPairs}</small>
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">MOVES</span>
          <strong>{moves}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">TIME</span>
          <strong>{formatTime(seconds)}</strong>
        </div>
        <div className="progress-card">
          <div className="progress-heading">
            <span>Collection progress</span>
            <strong>{Math.round((matchedCount / totalPairs) * 100)}%</strong>
          </div>
          <ProgressBar matchedCount={matchedCount} total={totalPairs} />
        </div>
      </section>

      <div className="play-area">
        <section className="board-section" aria-label="Pokémon memory cards">
          <div className="section-heading">
            <div>
              <h2>Your field</h2>
              <p>Choose two cards to reveal their Pokémon.</p>
            </div>
            <span className="deck-count">
              {(totalPairs - matchedCount) * 2} CARDS
            </span>
          </div>
          {!imagesReady && (
            <div className="image-loading" role="status" aria-live="polite">
              <span className="loading-orbit" aria-hidden="true">
                ✦
              </span>
              <div className="loading-copy">
                <strong>Preparing your Pokémon cards…</strong>
                <span>
                  {imageProgress.loaded} of {imageProgress.total} sprites ready
                </span>
                <div className="loading-track">
                  <span
                    style={{
                      width: `${(imageProgress.loaded / imageProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          {imagesReady && imageProgress.failed > 0 && (
            <p className="image-warning" role="status">
              {imageProgress.failed} sprite
              {imageProgress.failed === 1 ? "" : "s"} unavailable; fallback
              icons are being used.
            </p>
          )}
          <div className={`game-board${!imagesReady ? " is-loading" : ""}`}>
            {cards.map((card) => (
              <PokemonCard
                key={card.cardKey}
                pokemon={card}
                flipped={isFlipped(card)}
                matched={matchedIds.has(card.id)}
                imageState={spriteStates[card.id]}
                disabled={!imagesReady}
                onClick={() => handleCardClick(card)}
              />
            ))}
          </div>
        </section>

        <aside className="collection-panel" aria-labelledby="collectionTitle">
          <div className="collection-heading">
            <div>
              <p className="eyebrow">YOUR FINDS</p>
              <h2 id="collectionTitle">Matched stack</h2>
            </div>
            <span className="stack-count">{matchedCount}</span>
          </div>
          <p className="collection-copy">
            Every pair you find joins your collection here.
          </p>
          <div className="matched-stack" aria-live="polite">
            {matchedPokemon.length === 0 ? (
              <div className="empty-stack">
                <span aria-hidden="true">✧</span>
                <p>Your first match is waiting!</p>
              </div>
            ) : (
              matchedPokemon.map((pokemon) => (
                <div
                  className="stack-item"
                  key={pokemon.id}
                  title={`${pokemon.name} — ${pokemon.type}`}
                >
                  <PokemonSprite
                    pokemon={pokemon}
                    imageState={spriteStates[pokemon.id]}
                  />
                  <span>{pokemon.name}</span>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      <p className="game-message" role="status" aria-live="polite">
        {message}
      </p>
      <footer>
        Pokémon names and sprites are used for a fan-made memory game. Sprite
        images are preloaded before play begins.
      </footer>

      {showWin && (
        <div className="modal-backdrop">
          <section
            className="win-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="winTitle"
          >
            <div className="win-icon" aria-hidden="true">
              🏆
            </div>
            <p className="eyebrow">COLLECTION COMPLETE</p>
            <h2 id="winTitle">You matched them all!</h2>
            <p>
              You found all {totalPairs} pairs in {moves} moves and{" "}
              {formatTime(seconds)}.
            </p>
            <button
              className="primary-button"
              onClick={resetGame}
              type="button"
            >
              Play again
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
