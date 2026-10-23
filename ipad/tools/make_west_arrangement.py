import struct,sys
N={'C':0,'C#':1,'D':2,'Eb':3,'E':4,'F':5,'F#':6,'G':7,'Ab':8,'A':9,'Bb':10,'B':11}
def p(n):  # "F#4" -> midi
    name,octv=n[:-1],int(n[-1]); return 12*(octv+1)+N[name]
TPQ=480
# Melody: (note, start beat, length beats). Beat 0 = first downbeat of the A theme; pickup is negative.
A=[('A3',-1.5,.5),('A3',-1,1),
   ('F#4',0,4),('D4',4,3),('D4',7,1),('B4',8,1),('G5',9,2),('F#5',11,.5),('E5',11.5,5.5),
   ('D5',17,1.5),('C#5',18.5,1),('B4',19.5,.5),('A4',20,3),('A4',23,1),('B4',24,1),('D4',25,3),('E4',28,4)]
o=36  # second statement: lead-in bar starts at beat 32, its first downbeat at 36
B=[('F#4',32,2.5),('G4',34.5,.5),('F#4',35,.5),('E4',35.5,.5),
   ('D4',o+0,3),('D4',o+3,1),('B4',o+4,1),('G5',o+5,2),('F#5',o+7,.5),('E5',o+7.5,.5),
   ('F#5',o+8,3),('E5',o+11,1),('E5',o+12,1),('D5',o+13,1.5),('C#5',o+14.5,.5),('D5',o+15,.5),('B4',o+15.5,.5),
   ('A4',o+16,3),('A4',o+19,1),('B4',o+20,1),('G5',o+21,1),('E5',o+22,1.5),('D5',o+23.5,.5),
   ('F#5',o+24,3.5),('A4',o+27.5,.5),('B4',o+28,1),('G5',o+29,1),('E5',o+30,1.5),('D5',o+31.5,.5),('D5',o+32,8)]
D=['D3','F#3','A3']; Bm=['B2','D3','F#3']; G=['G2','B2','D3']; Fm=['F#2','A2','C#3']
Ac=['C#3','E3','A3']; Am=['A2','C3','E3']; Aa=['A2','C#3','E3']; Fc=['C#3','F#3','A3']
# Left hand chords (chord, start, length) — the orchestra's harmony and bass line.
L=[(D,0,2),(Ac,2,2),(Bm,4,2),(Am,6,1),(G,7,1),(G,8,4),(D,12,4),(Bm,16,4),(Fm,20,4),(G,24,4),(['D3','A3'],28,4),
   (D,32,2),(Ac,34,2),
   (Bm,o+0,2),(Am,o+2,2),(G,o+4,4),(Fc,o+8,4),(Bm,o+12,4),(Fm,o+16,4),(G,o+20,2),(Aa,o+22,2),
   (D,o+24,4),(G,o+28,2),(Aa,o+30,2),(D+['D2'],o+32,8)]
shift=4  # leave a bar before the pickup so beats stay positive
def events(notes,vel):
    ev=[]
    for pitches,st,ln in notes:
        for n in (pitches if isinstance(pitches,list) else [pitches]):
            t0=int((st+shift)*TPQ); t1=int((st+shift+ln)*TPQ)-12
            ev.append((t0,1,p(n),vel)); ev.append((t1,0,p(n),0))
    return sorted(ev,key=lambda e:(e[0],e[1]))
def vlq(v):
    b=[v&0x7f]; v>>=7
    while v: b.insert(0,(v&0x7f)|0x80); v>>=7
    return bytes(b)
def track(name,ev,meta=b''):
    data=b'\x00\xff\x03'+vlq(len(name))+name.encode()+meta+b'\x00\xc0\x00'
    last=0
    for t,on,n,v in ev:
        data+=vlq(t-last)+bytes([0x90 if on else 0x80,n,v]); last=t
    data+=b'\x00\xff\x2f\x00'
    return b'MTrk'+struct.pack('>I',len(data))+data
tempo=struct.pack('>I',int(60e6/116))[1:]
meta=b'\x00\xff\x51\x03'+tempo+b'\x00\xff\x58\x04\x04\x02\x18\x08'
out=b'MThd'+struct.pack('>IHHH',6,1,2,TPQ)
out+=track('Right hand',events([(n,s,l) for n,s,l in A+B],84),meta)
out+=track('Left hand',events(L,58))
open(sys.argv[1],'wb').write(out)
# Harmony check: every melody note on a strong beat should belong to the chord under it.
pcs=lambda ns:{N[x[:-1]] for x in ns}
for n,s,l in A+B:
    ch=[c for c,cs,cl in L if cs<=s<cs+cl]
    if ch and N[n[:-1]] not in pcs(ch[0]) and l>=1: print('  long non-chord tone:',n,'at beat',s,'over',ch[0])
print('written',len(out),'bytes')
