export const initialRoadMap = {
  storyOrder: ['story-start', 'story-key', 'story-forest', 'story-door', 'story-letter', 'story-home', 'story-morning'],
  nodes: [
    { id: 'story-start', type: 'roadmapStory', position: { x: 0, y: 0 }, data: { role: 'story', name: 'はじまりの街', emoji: '🏡', content: 'いつもと変わらない朝。ことねは祖母の部屋で、一通の古い手紙を見つける。' } },
    { id: 'story-key', type: 'roadmapStory', position: { x: 0, y: 0 }, data: { role: 'story', name: '古い鍵の秘密', emoji: '🗝️', content: '手紙に添えられていた小さな鍵。その模様は、街で見かけた不思議な紋章と同じだった。' } },
    { id: 'story-forest', type: 'roadmapStory', position: { x: 0, y: 0 }, data: { role: 'story', name: '森の向こうへ', emoji: '🌲', content: '手がかりを追い、街はずれの森へ。道に迷った先で、忘れられた建物にたどり着く。' } },
    { id: 'story-door', type: 'roadmapStory', position: { x: 0, y: 0 }, data: { role: 'story', name: '扉のその先', emoji: '🚪', content: '鍵がぴたりとはまった。静かに開いた扉の向こうに、物語の続きが待っている。' } },
    { id: 'story-letter', type: 'roadmapStory', position: { x: 0, y: 0 }, data: { role: 'story', name: 'もう一つの手紙', emoji: '💌', content: '扉の先にあったのは、祖母が未来に託した手紙だった。' } },
    { id: 'story-home', type: 'roadmapStory', position: { x: 0, y: 0 }, data: { role: 'story', name: '帰り道', emoji: '🧭', content: '秘密を知ったことねは、見慣れた街へと歩きはじめる。' } },
    { id: 'story-morning', type: 'roadmapStory', position: { x: 0, y: 0 }, data: { role: 'story', name: '新しい朝', emoji: '🎉', content: '街はいつもどおり。でも、ことねの世界は少しだけ広がっていた。' } },
  ],
}
